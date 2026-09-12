import { LearningPath, ILearningPath } from '../../models/LearningPath';
import { Course, ICourse } from '../../models/Course';
import { User } from '../../models/User';
import { skillGapService } from '../skillGap/skillGap.service';
import { notFound } from '../../utils/errors';
import { logger } from '../../utils/logger';

const log = logger;

const LEVEL_ORDER: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

/**
 * Learning path engine (prompt §17): builds a prerequisite-aware sequence of
 * courses targeting the learner's top gaps. Ordering: lowest level first,
 * then gap priority. Deterministic — AI only narrates, never sequences.
 */
export const learningPathService = {
  async generateForUser(userId: string, opts: { targetSkills?: string[]; title?: string } = {}): Promise<ILearningPath> {
    const user = await User.findById(userId);
    if (!user) throw notFound('User not found');

    const gaps = await skillGapService.topGaps(userId, opts.targetSkills?.length ?? 5);
    const targetCodes =
      opts.targetSkills && opts.targetSkills.length
        ? opts.targetSkills.map((s) => s.toUpperCase())
        : gaps.map((g) => String(g.competencyCode));

    // Candidate courses covering the target skills.
    const candidates = await Course.find({ isActive: true, skills: { $in: targetCodes } }).limit(40);

    // Dedupe by title, keep the most relevant per skill (most gap coverage).
    const byTitle = new Map<string, ICourse>();
    for (const c of candidates) {
      const key = c.title.toLowerCase();
      const existing = byTitle.get(key);
      if (!existing || c.skills.filter((s) => targetCodes.includes(s)).length > existing.skills.filter((s) => targetCodes.includes(s)).length) {
        byTitle.set(key, c);
      }
    }
    let picked = [...byTitle.values()].slice(0, 6);

    // Prerequisite-aware ordering: lower levels first; within a level, broader skill coverage first.
    picked = picked.sort((a, b) => {
      const lvl = (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1);
      if (lvl !== 0) return lvl;
      return (
        b.skills.filter((s) => targetCodes.includes(s)).length -
        a.skills.filter((s) => targetCodes.includes(s)).length
      );
    });

    const steps = picked.map((course, i) => ({
      order: i + 1,
      courseId: course._id,
      title: course.title,
      level: course.level,
      competencyIds: [],
      reason:
        i === 0
          ? `Starts at ${course.level.toLowerCase()} level to build foundations for your top gaps.`
          : `Builds on the previous step towards ${course.skills.filter((s) => targetCodes.includes(s)).join(', ') || 'your target skills'}.`,
      status: i === 0 ? ('AVAILABLE' as const) : ('LOCKED' as const),
      prerequisiteIds: i === 0 ? [] : [picked[i - 1]._id],
    }));

    // Replace any existing active path.
    await LearningPath.updateMany({ userId, status: 'ACTIVE' }, { status: 'ARCHIVED', isActive: false });

    const path = await LearningPath.create({
      userId,
      title: opts.title ?? `Learning path — ${targetCodes.slice(0, 3).join(', ') || 'core competencies'}`,
      description: `Prerequisite-aware sequence targeting your highest-priority skill gaps (${targetCodes.join(', ') || 'n/a'}).`,
      targetSkills: targetCodes,
      steps,
      currentStep: 0,
      progress: 0,
      status: 'ACTIVE',
      generatedBy: 'RULE',
    });
    log.info({ userId, steps: steps.length }, 'learning path generated');
    return path;
  },

  async getActive(userId: string): Promise<ILearningPath | null> {
    return LearningPath.findOne({ userId, status: 'ACTIVE' }).populate('steps.courseId', 'title provider level durationHours url thumbnail');
  },

  async list(userId: string): Promise<ILearningPath[]> {
    return LearningPath.find({ userId }).sort({ createdAt: -1 }).limit(20);
  },

  /** Advances the path when a course in it completes. */
  async onCourseCompleted(userId: string, courseId: string): Promise<void> {
    const path = await LearningPath.findOne({ userId, status: 'ACTIVE' });
    if (!path) return;
    const step = path.steps.find((s) => String(s.courseId) === String(courseId));
    if (!step || step.status === 'COMPLETED') return;

    step.status = 'COMPLETED';
    const idx = path.steps.indexOf(step);
    const next = path.steps[idx + 1];
    if (next && next.status === 'LOCKED') next.status = 'AVAILABLE';

    const completedCount = path.steps.filter((s) => s.status === 'COMPLETED').length;
    path.progress = Math.round((completedCount / Math.max(1, path.steps.length)) * 100);
    path.currentStep = Math.min(path.steps.length - 1, idx + 1);
    if (path.progress >= 100) path.status = 'COMPLETED';
    await path.save();
  },
};
