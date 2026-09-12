import { User } from '../../models/User';
import { Role } from '../../models/Role';
import { Competency } from '../../models/Competency';
import { UserCompetency } from '../../models/UserCompetency';
import { SkillGap } from '../../models/SkillGap';
import { QuizAttempt } from '../../models/QuizAttempt';
import { Quiz } from '../../models/Quiz';
import { Enrollment } from '../../models/Enrollment';
import { notFound } from '../../utils/errors';

/** 0–100 score → 0–5 display level. */
export const scoreToLevel = (score: number): number =>
  Math.max(0, Math.min(5, Math.round(score / 20)));

export const adminInsightsService = {
  /**
   * Division × competency heatmap cells. meanGap is normalised 0..1 so the
   * frontend heat scale stays comparable across competencies.
   */
  async heatmap(limitDepts = 12, limitCompetencies = 16) {
    const learners = await User.find({ role: 'LEARNER', isActive: true }).select('_id department');
    const deptByUser = new Map(learners.map((u) => [String(u._id), u.department?.trim() || 'Unassigned']));
    const deptNames = [...new Set(deptByUser.values())].sort().slice(0, limitDepts);

    const competencies = await Competency.find({ isActive: true }).sort({ name: 1 }).limit(limitCompetencies);
    const compIds = new Set(competencies.map((c) => String(c._id)));

    const gaps = await SkillGap.find({ userId: { $in: learners.map((u) => u._id) } })
      .select('userId competencyId gap requiredScore')
      .lean();
    const acc = new Map<string, { total: number; count: number }>();
    for (const g of gaps) {
      const compId = String(g.competencyId);
      if (!compIds.has(compId)) continue;
      const dept = deptByUser.get(String(g.userId)) ?? 'Unassigned';
      if (!deptNames.includes(dept)) continue;
      const key = `${dept}||${compId}`;
      const cur = acc.get(key) ?? { total: 0, count: 0 };
      cur.total += Math.max(0, Math.min(100, g.gap ?? 0)) / 100;
      cur.count += 1;
      acc.set(key, cur);
    }
    const cells = [...acc.entries()].map(([key, v]) => {
      const [dept, competencyId] = key.split('||');
      return { departmentId: dept, competencyId, meanGap: Math.round((v.total / v.count) * 1000) / 1000 };
    });
    return {
      departments: deptNames.map((name) => ({ id: name, name })),
      competencies: competencies.map((c) => ({ id: String(c._id), code: c.code, name: c.name })),
      cells,
    };
  },

  /** Readiness (0..1) + open gap count for a batch of users (directory enrichment). */
  async enrichUsers(userIds: string[]): Promise<Map<string, { readiness: number; gapCount: number }>> {
    const out = new Map<string, { readiness: number; gapCount: number }>();
    if (!userIds.length) return out;
    const gaps = await SkillGap.find({ userId: { $in: userIds } })
      .select('userId gap requiredScore currentScore')
      .lean();
    const byUser = new Map<string, typeof gaps>();
    for (const g of gaps) {
      const key = String(g.userId);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(g);
    }
    for (const id of userIds) {
      const rows = byUser.get(id) ?? [];
      const usable = rows.filter((r) => (r.requiredScore ?? 0) > 0);
      const readiness = usable.length
        ? usable.reduce((s, r) => s + Math.max(0, Math.min(1, (r.currentScore ?? 0) / (r.requiredScore || 1))), 0) / usable.length
        : 0;
      out.set(id, {
        readiness: Math.round(readiness * 1000) / 1000,
        gapCount: rows.filter((r) => (r.gap ?? 0) > 0).length,
      });
    }
    return out;
  },

  /** Officer 360° view for the admin directory detail page (audit-logged by the route). */
  async userDetail(userId: string) {
    const officer = await User.findById(userId).select('-passwordHash -refreshTokens');
    if (!officer) throw notFound('User not found');
    const [role, competencies, gaps, attempts, enrollments] = await Promise.all([
      officer.designation ? Role.findOne({ name: officer.designation }) : null,
      UserCompetency.find({ userId }).populate('competencyId', 'name code category').sort({ gap: -1 }),
      SkillGap.find({ userId, gap: { $gt: 0 } }).sort({ gap: -1 }),
      QuizAttempt.find({ userId }).sort({ submittedAt: -1 }).limit(50),
      Enrollment.find({ userId }).populate('courseId', 'title provider').sort({ lastAccessedAt: -1 }),
    ]);
    const quizTitles = new Map<string, string>();
    const quizIds = [...new Set(attempts.map((a) => String(a.quizId)))];
    if (quizIds.length) {
      const quizzes = await Quiz.find({ _id: { $in: quizIds } }).select('title');
      for (const q of quizzes) quizTitles.set(String(q._id), q.title);
    }
    return {
      officer: {
        id: String(officer._id),
        name: officer.name,
        email: officer.email,
        employeeId: officer.employeeId ?? '—',
        role: officer.role,
        xp: officer.xp ?? 0,
        level: officer.level ?? 1,
      },
      jobRole: role ? { title: role.name, code: role.code } : { title: officer.designation ?? '—', code: null },
      department: { name: officer.department ?? 'Unassigned' },
      competencies: competencies.map((c) => ({
        competency: {
          _id: String((c.competencyId as unknown as { _id: unknown })._id ?? c.competencyId),
          name: (c.competencyId as unknown as { name?: string }).name ?? '—',
          category: (c.competencyId as unknown as { category?: string }).category,
        },
        currentLevel: scoreToLevel(c.currentScore),
        currentScore: c.currentScore,
        requiredScore: c.requiredScore,
        gap: c.gap,
        priority: c.priority,
        confidence: c.confidence,
        source: c.source,
        lastAssessmentAt: c.lastAssessedAt,
      })),
      gaps: gaps.map((g) => ({
        competencyId: String(g.competencyId),
        competency: { _id: String(g.competencyId), name: g.competencyName ?? g.competencyCode },
        currentLevel: scoreToLevel(g.currentScore),
        requiredLevel: scoreToLevel(g.requiredScore),
        currentScore: g.currentScore,
        requiredScore: g.requiredScore,
        gap: Math.max(0, Math.min(1, g.gap / 100)),
        gapPoints: g.gap,
        band: g.priority === 'MEDIUM' ? 'moderate' : g.priority.toLowerCase(),
        priorityBand: g.priority === 'MEDIUM' ? 'moderate' : g.priority.toLowerCase(),
      })),
      quizHistory: attempts.map((a) => ({
        _id: String(a._id),
        quizTitle: quizTitles.get(String(a.quizId)) ?? 'Quiz',
        competency: { name: a.topicPerformance?.[0]?.topic ?? quizTitles.get(String(a.quizId)) ?? 'Quiz' },
        score: a.score,
        scoreRatio: a.score / 100,
        passed: a.score >= 70,
        xpAwarded: a.xpAwarded ?? 0,
        correctAnswers: a.correctAnswers,
        totalQuestions: a.totalQuestions,
        topics: (a.topicPerformance ?? []).map((t) => ({ topic: t.topic, percent: t.percent })),
        createdAt: a.submittedAt,
      })),
      learningProgress: enrollments.map((e) => ({
        _id: String(e._id),
        course: {
          _id: String((e.courseId as unknown as { _id: unknown })._id ?? e.courseId),
          title: (e.courseId as unknown as { title?: string }).title ?? '—',
          provider: (e.courseId as unknown as { provider?: string }).provider,
        },
        status: e.status === 'COMPLETED' ? 'completed' : 'in_progress',
        percentComplete: e.progress,
        timeSpentMinutes: e.timeSpentMinutes,
      })),
    };
  },
};
