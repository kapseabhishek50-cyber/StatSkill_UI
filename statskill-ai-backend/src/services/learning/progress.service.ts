import { LearningProgress } from '../../models/LearningProgress';
import { LearningActivity } from '../../models/LearningActivity';
import { Enrollment } from '../../models/Enrollment';

/** Granular progress inspection helpers (behind learning.service aggregate). */
export const progressService = {
  async courseTimeline(userId: string, courseId: string) {
    const [records, activity] = await Promise.all([
      LearningProgress.find({ userId, courseId }).sort({ itemIndex: 1 }),
      LearningActivity.find({ userId, refId: courseId, type: { $in: ['LESSON_COMPLETED', 'COURSE_STARTED', 'COURSE_COMPLETED'] } })
        .sort({ createdAt: -1 })
        .limit(50),
    ]);
    return { records, activity };
  },

  async summary(userId: string) {
    const [enrollments, activities] = await Promise.all([
      Enrollment.find({ userId }),
      LearningActivity.find({ userId }).sort({ createdAt: -1 }).limit(100),
    ]);
    const totalMinutes = enrollments.reduce((s, e) => s + e.timeSpentMinutes, 0);
    const byType: Record<string, number> = {};
    for (const a of activities) byType[a.type] = (byType[a.type] ?? 0) + 1;
    return {
      coursesActive: enrollments.filter((e) => e.status === 'ACTIVE').length,
      coursesCompleted: enrollments.filter((e) => e.status === 'COMPLETED').length,
      totalTimeSpentMinutes: totalMinutes,
      recentActivityByType: byType,
    };
  },
};
