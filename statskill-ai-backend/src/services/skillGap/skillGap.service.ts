import { SkillGap, ISkillGap } from '../../models/SkillGap';
import { UserCompetency } from '../../models/UserCompetency';
import { Competency } from '../../models/Competency';
import { User } from '../../models/User';
import { competencyService } from '../competency/competency.service';
import { logger } from '../../utils/logger';

const log = logger;

/**
 * Skill-gap engine (prompt §5-6): gap = required - current; priority from
 * configurable thresholds. Fully deterministic.
 */
export const skillGapService = {
  /** Recomputes + persists the full gap snapshot for a user. */
  async recalculateForUser(userId: string): Promise<ISkillGap[]> {
    const user = await User.findById(userId);
    if (!user) return [];
    const requirements = await competencyService.getRequirementsForUser(userId, user.designation);
    const measured = await UserCompetency.find({ userId });
    const competencies = await Competency.find({ isActive: true });
    const byId = new Map(competencies.map((c) => [String(c._id), c]));

    // Build the complete picture: measured + unmeasured (implied gap).
    const rows: {
      competencyId: string;
      code: string;
      name: string;
      category: string;
      current: number;
      required: number;
      source: string;
    }[] = [];

    for (const c of competencies) {
      const req = requirements.get(c.code);
      const requiredScore = req?.requiredScore ?? c.defaultRequiredScore;
      const m = measured.find((x) => String(x.competencyId) === String(c._id));
      rows.push({
        competencyId: String(c._id),
        code: c.code,
        name: c.name,
        category: c.category,
        current: m?.currentScore ?? 0,
        required: requiredScore,
        source: m?.source ?? 'NONE',
      });
    }

    const ops = rows.map((r) => ({
      filter: { userId, competencyId: r.competencyId },
      update: {
        $set: {
          competencyCode: r.code,
          competencyName: r.name,
          category: r.category,
          currentScore: r.current,
          requiredScore: r.required,
          gap: Math.max(0, r.required - r.current),
          lastCalculatedAt: new Date(),
        },
        $setOnInsert: { priority: 'LOW' as const, status: 'OPEN' as const, recommendedCourseIds: [] },
      },
    }));
    // Per-row upserts (N <= ~40). A bulkWrite is avoided deliberately: some
    // MongoDB-compatible fallback stores mishandle ObjectId-filtered bulk ops.
    for (const op of ops) {
      await SkillGap.findOneAndUpdate(op.filter, op.update, { upsert: true, setDefaultsOnInsert: true });
    }

    // Priority/status recompute via save hook on fetched docs (keeps logic in one place).
    const docs = await SkillGap.find({ userId });
    for (const d of docs) {
      const gap = Math.max(0, Math.round(d.requiredScore - d.currentScore));
      const priority = gap >= 40 ? 'CRITICAL' : gap >= 25 ? 'HIGH' : gap >= 10 ? 'MEDIUM' : 'LOW';
      const status = gap === 0 ? 'CLOSED' : d.currentScore > 0 && d.currentScore >= d.requiredScore ? 'CLOSED' : 'OPEN';
      let changed = false;
      if (d.priority !== priority) { d.priority = priority; changed = true; }
      if (d.status !== status) { d.status = status; changed = true; }
      if (d.gap !== gap) { d.gap = gap; changed = true; }
      if (changed) await d.save();
    }

    log.debug({ userId, gaps: docs.length }, 'skill gaps recalculated');
    return docs;
  },

  async listForUser(userId: string, onlyOpen = false): Promise<ISkillGap[]> {
    const filter: Record<string, unknown> = { userId };
    if (onlyOpen) filter.status = { $ne: 'CLOSED' };
    return SkillGap.find(filter).sort({ priority: 1, gap: -1 });
  },

  async topGaps(userId: string, n = 5): Promise<ISkillGap[]> {
    return SkillGap.find({ userId, status: { $ne: 'CLOSED' }, gap: { $gt: 0 } })
      .sort({ gap: -1 })
      .limit(n);
  },

  async linkRecommendation(userId: string, competencyId: string, courseId: string): Promise<void> {
    await SkillGap.updateOne(
      { userId, competencyId },
      { $addToSet: { recommendedCourseIds: courseId } }
    );
  },

  /** Platform-wide aggregated gaps (admin analytics). */
  async aggregatedTopGaps(limit = 10) {
    return SkillGap.aggregate([
      { $match: { status: { $ne: 'CLOSED' } } },
      {
        $group: {
          _id: '$competencyCode',
          competencyName: { $first: '$competencyName' },
          category: { $first: '$category' },
          affectedUsers: { $sum: 1 },
          avgGap: { $avg: '$gap' },
          criticalCount: { $sum: { $cond: [{ $eq: ['$priority', 'CRITICAL'] }, 1, 0] } },
        },
      },
      { $sort: { affectedUsers: -1, avgGap: -1 } },
      { $limit: limit },
    ]);
  },
};
