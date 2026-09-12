import { Recommendation, IRecommendation } from '../../models/Recommendation';
import { Course, ICourse } from '../../models/Course';
import { User } from '../../models/User';
import { Enrollment } from '../../models/Enrollment';
import { SkillGap, ISkillGap } from '../../models/SkillGap';
import { competencyService } from '../competency/competency.service';
import { skillGapService } from '../skillGap/skillGap.service';
import { recommendationConfig } from '../../config/recommendation';
import { audit } from '../../middleware/audit.middleware';
import { logger } from '../../utils/logger';
import {
  computeGapScore,
  computeRoleMatch,
  computeSemanticScore,
  computeDifficultyMatch,
  computeHistoryScore,
  computePopularity,
  computeFreshness,
  computeFinalScore,
  targetLevelForExperience,
  CourseGapContext,
  RoleContext,
} from './scoring.service';
import { ensureCourseEmbedding, getUserProfileEmbedding, loadCourseVectors, buildCourseEmbeddingText, hashText } from './semantic.service';
import { rankCandidates, matchScorePercent, RankedCandidate } from './ranking.service';
import { aiService } from '../ai/ai.service';

const log = logger;

export interface RefreshOptions {
  topN?: number;
  useAI?: boolean;
  competencyCode?: string; // restrict to one skill
}

const COURSE_FIELDS = 'title provider level durationHours url category thumbnail skills rating';

/** Flattens a populated recommendation into the §13 API shape. */
const presentRecommendation = (doc: IRecommendation): Record<string, unknown> => {
  const course = doc.courseId as unknown as {
    _id?: unknown; title?: string; provider?: string; level?: string; url?: string;
    thumbnail?: string; durationHours?: number; category?: string; rating?: number;
  } | null;
  const plain = doc.toObject();
  const courseId = course?._id ? String(course._id) : String(doc.courseId);
  return {
    ...plain,
    courseId,
    title: course?.title,
    provider: course?.provider,
    level: course?.level,
    url: course?.url,
    thumbnail: course?.thumbnail,
    durationHours: course?.durationHours,
    category: course?.category,
    rating: course?.rating,
    skill: doc.skillName ?? doc.skillCode,
  };
};

export const recommendationService = {
  /**
   * HYBRID pipeline (prompt §7):
   *   profile → competency scores → skill gaps → candidate retrieval →
   *   rule filtering → embeddings → weighted ranking → top courses →
   *   optional AI explanation → persist.
   */
  async refreshForUser(userId: string, opts: RefreshOptions = {}): Promise<IRecommendation[]> {
    const user = await User.findById(userId);
    if (!user) return [];

    // 1-2. Competency scores + 3. skill gaps (deterministic).
    const gaps = await skillGapService.recalculateForUser(userId);
    const openGaps = gaps.filter((g) => g.status !== 'CLOSED' && g.gap > 0).sort((a, b) => b.gap - a.gap);
    const filteredGaps = opts.competencyCode
      ? openGaps.filter((g) => g.competencyCode === opts.competencyCode)
      : openGaps;

    const userComps = await competencyService.getUserCompetencies(userId);
    const gapByCode: CourseGapContext['gapByCode'] = new Map(
      gaps.map((g) => [String(g.competencyCode), { current: g.currentScore, required: g.requiredScore, gap: g.gap }])
    );
    const roleCtx: RoleContext = { roleByCode: new Map() };
    const requirements = await competencyService.getRequirementsForUser(userId, user.designation);
    for (const [code, req] of requirements) {
      roleCtx.roleByCode.set(code, { requiredScore: req.requiredScore, weight: req.weight });
    }

    // 4. Candidate retrieval.
    const skillCodes = filteredGaps.map((g) => String(g.competencyCode));
    const enrollments = await Enrollment.find({ userId });
    const enrolledIds = new Set(enrollments.map((e) => String(e.courseId)));
    const completedIds = new Set(
      enrollments.filter((e) => e.status === 'COMPLETED').map((e) => String(e.courseId))
    );

    const baseFilter: Record<string, unknown> = { isActive: true };
    if (skillCodes.length) baseFilter.skills = { $in: skillCodes };

    let candidates: ICourse[] = await Course.find(baseFilter).limit(recommendationConfig.candidatePool);
    // Widen the pool when too few gap-tagged courses exist.
    if (candidates.length < 10) {
      const extra = await Course.find({ isActive: true })
        .limit(recommendationConfig.candidatePool)
        .sort({ enrollmentCount: -1 });
      const seen = new Set(candidates.map((c) => String(c._id)));
      candidates = [...candidates, ...extra.filter((c) => !seen.has(String(c._id)))];
    }

    // 5. Rule-based filtering.
    const seenTitles = new Set<string>();
    candidates = candidates.filter((c) => {
      if (recommendationConfig.excludeCompleted && completedIds.has(String(c._id))) return false;
      if (recommendationConfig.excludeEnrolled && enrolledIds.has(String(c._id))) return false;
      const key = c.title.toLowerCase().trim();
      if (seenTitles.has(key)) return false; // dedupe
      seenTitles.add(key);
      return true;
    });

    // Embeddings for courses missing them (usually right after a sync).
    await Promise.all(candidates.map((c) => ensureCourseEmbedding(c)));

    // 6. Semantic similarity.
    const completedTitles = await Course.find({ _id: { $in: [...completedIds] } }).select('title');
    const userVector = await getUserProfileEmbedding(
      user,
      filteredGaps.slice(0, 8),
      completedTitles.map((c) => c.title)
    );
    const courseVectors = await loadCourseVectors(candidates.map((c) => String(c._id)));
    const completedVectors = [
      ...(await loadCourseVectors(completedTitles.map((c) => String(c._id)))).values(),
    ];
    const maxEnrollment = candidates.reduce((m, c) => Math.max(m, c.enrollmentCount), 0);
    const targetLevel = targetLevelForExperience(user.experience);

    // 7. Weighted ranking.
    const ranked: RankedCandidate[] = candidates.map((course) => {
      const primaryGap = filteredGaps.find((g) => course.skills.includes(String(g.competencyCode)));
      const cv = courseVectors.get(String(course._id)) ?? null;
      const components = {
        gap: computeGapScore(course, { gapByCode }),
        role: computeRoleMatch(course, roleCtx),
        semantic: computeSemanticScore(userVector, cv),
        difficulty: computeDifficultyMatch(course, targetLevel),
        history: computeHistoryScore(cv, completedVectors),
        popularity: computePopularity(course, maxEnrollment),
        freshness: computeFreshness(course),
      };
      return {
        courseId: String(course._id),
        course,
        skillCode: primaryGap ? String(primaryGap.competencyCode) : course.skills[0] ?? null,
        skillName: primaryGap?.competencyName ?? null,
        priority: primaryGap?.priority ?? 'LOW',
        scores: computeFinalScore(components),
      };
    });

    const topN = opts.topN ?? recommendationConfig.topN;
    const top = rankCandidates(ranked, topN);

    // 8-9. AI explanation (optional; deterministic reasons always exist first).
    const deterministicReason = (r: RankedCandidate): string => {
      const course = r.course as ICourse;
      const gapInfo = r.skillCode ? gapByCode.get(r.skillCode) : undefined;
      if (gapInfo) {
        return `Your ${r.skillName ?? r.skillCode} competency is ${gapInfo.current}% while your role requires ${gapInfo.required}% (gap: ${gapInfo.gap} points). This ${course.level.toLowerCase()} course from ${course.provider} targets that gap.`;
      }
      return `Relevant ${course.level.toLowerCase()} course from ${course.provider} for your role as ${user.designation ?? 'an officer'}.`;
    };

    let explanations = new Map<string, { reason?: string; improvesSkill?: string; roleRelevance?: string; outcome?: string; sequenceNote?: string; source: 'AI' | 'DETERMINISTIC' }>();
    if (opts.useAI !== false) {
      explanations = await aiService.explainRecommendations(user, top, deterministicReason);
    }

    // Persist — upsert one recommendation per (user, course); expire stale ACTIVE docs.
    const now = new Date();
    await Recommendation.updateMany(
      { userId, status: 'ACTIVE', courseId: { $nin: top.map((t) => t.courseId) } },
      { status: 'EXPIRED' }
    );

    const docs: IRecommendation[] = [];
    for (let i = 0; i < top.length; i++) {
      const r = top[i];
      const course = r.course as ICourse;
      const ex = explanations.get(r.courseId);
      const reason = ex?.reason || deterministicReason(r);
      const competencyId = r.skillCode ? (await competencyService.getByCode(r.skillCode))?._id : undefined;
      const doc = await Recommendation.findOneAndUpdate(
        { userId, courseId: r.courseId },
        {
          $set: {
            competencyId: competencyId ?? undefined,
            skillCode: r.skillCode ?? undefined,
            skillName: r.skillName ?? undefined,
            priority: r.priority,
            matchScore: matchScorePercent(r.scores.final),
            scores: {
              gap: Math.round(r.scores.gap * 100) / 100,
              role: Math.round(r.scores.role * 100) / 100,
              semantic: Math.round(r.scores.semantic * 100) / 100,
              difficulty: Math.round(r.scores.difficulty * 100) / 100,
              history: Math.round(r.scores.history * 100) / 100,
              popularity: Math.round(r.scores.popularity * 100) / 100,
              freshness: Math.round(r.scores.freshness * 100) / 100,
              final: Math.round(r.scores.final * 100) / 100,
            },
            reason,
            reasonSource: ex?.source === 'AI' ? 'AI' : 'DETERMINISTIC',
            explanation: ex
              ? {
                  improvesSkill: ex.improvesSkill,
                  roleRelevance: ex.roleRelevance,
                  outcome: ex.outcome,
                  sequenceNote: ex.sequenceNote,
                }
              : undefined,
            status: 'ACTIVE',
            generatedAt: now,
          },
        },
        { upsert: true, new: true }
      );
      docs.push(doc);
      if (r.skillCode && competencyId) {
        void skillGapService.linkRecommendation(userId, String(competencyId), r.courseId);
      }
    }

    void audit(null, 'RECOMMENDATION_GENERATED', 'user', userId, {
      count: docs.length,
      aiExplanations: [...explanations.values()].filter((e) => e.source === 'AI').length,
    });
    log.info({ userId, generated: docs.length }, 'recommendations refreshed');

    // Return populated, presentation-shaped docs (§13: title, matchScore, reason, priority).
    const ids = docs.map((d) => d._id);
    const populated = await Recommendation.find({ _id: { $in: ids } }).populate('courseId', COURSE_FIELDS);
    const byId = new Map(populated.map((p) => [String(p._id), p]));
    return docs.map((d) => presentRecommendation(byId.get(String(d._id)) ?? d) as unknown as IRecommendation);
  },

  async listForUser(userId: string, opts: { page: number; limit: number; status?: string }): Promise<{ items: IRecommendation[]; total: number }> {
    const filter: Record<string, unknown> = { userId };
    filter.status = opts.status ?? 'ACTIVE';
    // Expire stale docs lazily.
    await Recommendation.updateMany(
      { userId, status: 'ACTIVE', generatedAt: { $lt: new Date(Date.now() - recommendationConfig.recommendationsValidDays * 86400000) } },
      { status: 'EXPIRED' }
    );
    const [items, total] = await Promise.all([
      Recommendation.find(filter)
        .sort({ matchScore: -1 })
        .skip((opts.page - 1) * opts.limit)
        .limit(opts.limit)
        .populate('courseId', COURSE_FIELDS),
      Recommendation.countDocuments(filter),
    ]);
    return { items: items.map(presentRecommendation) as unknown as IRecommendation[], total };
  },

  async topForUser(userId: string, n = 5): Promise<IRecommendation[]> {
    await this.refreshIfEmpty(userId);
    const docs = await Recommendation.find({ userId, status: 'ACTIVE' })
      .sort({ matchScore: -1 })
      .limit(n)
      .populate('courseId', COURSE_FIELDS);
    return docs.map(presentRecommendation) as unknown as IRecommendation[];
  },

  async forSkill(userId: string, competencyId: string, limit = 5): Promise<IRecommendation[]> {
    const docs = await Recommendation.find({ userId, status: 'ACTIVE', $or: [{ competencyId }, { skillCode: competencyId.toUpperCase() }] })
      .sort({ matchScore: -1 })
      .limit(limit)
      .populate('courseId', COURSE_FIELDS);
    return docs.map(presentRecommendation) as unknown as IRecommendation[];
  },

  async dismiss(userId: string, recommendationId: string): Promise<IRecommendation | null> {
    return Recommendation.findOneAndUpdate({ _id: recommendationId, userId }, { status: 'DISMISSED' }, { new: true });
  },

  /** Triggers a background refresh when a user has no recommendations yet. */
  async refreshIfEmpty(userId: string): Promise<void> {
    const count = await Recommendation.countDocuments({ userId, status: 'ACTIVE' });
    if (count === 0) {
      const { enqueueJob } = await import('../../jobs/queue');
      const { recommendationJob } = await import('../../jobs/recommendation.job');
      void enqueueJob('recommendation-refresh', async () => {
        try {
          await this.refreshForUser(userId);
        } catch (err) {
          log.warn({ err: (err as Error).message, userId }, 'lazy recommendation refresh failed');
        }
      }, recommendationJob.name);
    }
  },

  /** Minimal diagnostic for a single course vs a user (used by tests + debug endpoint). */
  async explainScoreForCourse(userId: string, courseId: string) {
    const course = await Course.findById(courseId);
    if (!course) return null;
    const gaps: ISkillGap[] = await skillGapService.listForUser(userId);
    const gapByCode: CourseGapContext['gapByCode'] = new Map(
      gaps.map((g) => [String(g.competencyCode), { current: g.currentScore, required: g.requiredScore, gap: g.gap }])
    );
    const user = await User.findById(userId);
    const requirements = await competencyService.getRequirementsForUser(userId, user?.designation);
    const roleCtx: RoleContext = { roleByCode: new Map() };
    for (const [code, req] of requirements) roleCtx.roleByCode.set(code, { requiredScore: req.requiredScore, weight: req.weight });
    await ensureCourseEmbedding(course);
    const vectors = await loadCourseVectors([String(course._id)]);
    const components = {
      gap: computeGapScore(course, { gapByCode }),
      role: computeRoleMatch(course, roleCtx),
      semantic: 0,
      difficulty: computeDifficultyMatch(course, targetLevelForExperience(user?.experience ?? 0)),
      history: 0,
      popularity: computePopularity(course, course.enrollmentCount),
      freshness: computeFreshness(course),
    };
    return {
      courseId,
      components,
      embeddingText: buildCourseEmbeddingText(course),
      textHash: hashText(buildCourseEmbeddingText(course)),
      final: computeFinalScore(components),
    };
  },
};
