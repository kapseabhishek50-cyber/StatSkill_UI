import { Enrollment, IEnrollment } from '../../models/Enrollment';
import { Course, ICourse } from '../../models/Course';
import { notFound, conflict, badRequest } from '../../utils/errors';
import { recordLearningActivity } from './activity.service';
import { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';
import { Request } from 'express';
import { applyCourseCompletionBoost } from '../competency/competencyUpdate.service';
import { Competency } from '../../models/Competency';
import { recommendationJob } from '../../jobs/recommendation.job';

export const learningService = {
  /** Enroll (prompt §18). Idempotent: re-enrolling an existing enrollment returns it. */
  async enroll(userId: string, courseId: string): Promise<{ enrollment: IEnrollment; alreadyEnrolled: boolean }> {
    const course = await Course.findById(courseId);
    if (!course || !course.isActive) throw notFound('Course not found or inactive');

    const existing = await Enrollment.findOne({ userId, courseId });
    if (existing && existing.status === 'ACTIVE') return { enrollment: existing, alreadyEnrolled: true };
    if (existing && existing.status === 'COMPLETED') throw conflict('Course already completed');
    if (existing && existing.status === 'DROPPED') {
      existing.status = 'ACTIVE';
      existing.lastAccessedAt = new Date();
      await existing.save();
      return { enrollment: existing, alreadyEnrolled: true };
    }

    const enrollment = await Enrollment.create({ userId, courseId });
    await Course.updateOne({ _id: courseId }, { $inc: { enrollmentCount: 1 } });
    await recordLearningActivity({
      userId,
      type: 'COURSE_STARTED',
      refType: 'course',
      refId: courseId,
      title: course.title,
    });
    return { enrollment, alreadyEnrolled: false };
  },

  async myCourses(userId: string, req: Request, status?: string) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = String(status).toUpperCase();
    const [items, total] = await Promise.all([
      Enrollment.find(filter)
        .sort(mongoSort(p))
        .skip(p.skip)
        .limit(p.limit)
        .populate('courseId', 'title provider level durationHours category skills thumbnail url'),
      Enrollment.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async getProgress(userId: string, courseId: string) {
    const course = await Course.findById(courseId);
    if (!course) throw notFound('Course not found');
    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) throw notFound('Not enrolled in this course');
    return { enrollment, course: { title: course.title, modules: course.modules, totalModules: course.modules.length } };
  },

  /** PUT progress: record time + optionally mark module complete (server-authoritative). */
  async updateProgress(userId: string, courseId: string, input: { moduleIndex?: number; timeSpentMinutes?: number; currentModule?: number }) {
    const course = await Course.findById(courseId);
    if (!course) throw notFound('Course not found');
    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) throw notFound('Not enrolled in this course');
    if (enrollment.status === 'COMPLETED') throw badRequest('Course already completed');

    const totalModules = Math.max(1, course.modules.length);
    let completedModule: number | null = null;

    if (input.timeSpentMinutes) {
      enrollment.timeSpentMinutes += input.timeSpentMinutes;
    }
    if (typeof input.currentModule === 'number') {
      enrollment.currentModule = Math.max(0, Math.min(totalModules - 1, input.currentModule));
    }
    if (typeof input.moduleIndex === 'number') {
      const idx = Math.max(0, Math.min(totalModules - 1, input.moduleIndex));
      if (!enrollment.modulesCompleted.includes(idx)) {
        enrollment.modulesCompleted.push(idx);
        completedModule = idx;
      }
    }
    enrollment.progress = Math.round((enrollment.modulesCompleted.length / totalModules) * 100);
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    let activityResult = null;
    if (completedModule !== null) {
      const mod = course.modules[completedModule];
      activityResult = await recordLearningActivity({
        userId,
        type: 'LESSON_COMPLETED',
        refType: 'course',
        refId: courseId,
        title: mod ? `${course.title} — ${mod.title}` : course.title,
        metadata: { moduleIndex: completedModule },
      });
      // Auto-complete when every module is done.
      if (enrollment.modulesCompleted.length >= totalModules) {
        await this.complete(userId, courseId);
      }
    }
    return { enrollment, completedModule, activity: activityResult };
  },

  /** POST complete: idempotent completion with XP + competency bump + refresh. */
  async complete(userId: string, courseId: string) {
    const course = await Course.findById(courseId);
    if (!course) throw notFound('Course not found');
    let enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) throw notFound('Not enrolled in this course');
    if (enrollment.status === 'COMPLETED') {
      return { enrollment, alreadyCompleted: true, activity: null };
    }

    const totalModules = Math.max(1, course.modules.length);
    enrollment.modulesCompleted = course.modules.map((_, i) => i);
    enrollment.progress = 100;
    enrollment.status = 'COMPLETED';
    enrollment.completedAt = new Date();
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    const activity = await recordLearningActivity({
      userId,
      type: 'COURSE_COMPLETED',
      refType: 'course',
      refId: courseId,
      title: course.title,
    });

    // Small deterministic competency boost for course skills (prompt §27).
    const comps = await Competency.find({ code: { $in: course.skills } });
    for (const c of comps) {
      await applyCourseCompletionBoost(userId, String(c._id), c.defaultRequiredScore);
    }
    // Gaps changed → recommendations refresh in background.
    recommendationJob.enqueue(userId);

    void notificationServiceSafe(userId, course);
    return { enrollment, alreadyCompleted: false, activity };
  },
};

// Avoid a circular import with notification service at module load time.
const notificationServiceSafe = async (userId: string, course: ICourse) => {
  const { notificationService } = await import('../notification/notification.service');
  void notificationService.push({
    userId,
    type: 'COURSE_COMPLETED',
    title: 'Course completed 🎉',
    body: `You completed "${course.title}". Your recommendations have been refreshed.`,
    data: { courseId: String(course._id) },
  });
};
