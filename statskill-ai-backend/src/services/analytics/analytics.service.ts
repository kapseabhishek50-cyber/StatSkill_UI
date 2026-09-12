import { User } from '../../models/User';
import { Enrollment } from '../../models/Enrollment';
import { LearningActivity } from '../../models/LearningActivity';
import { QuizAttempt } from '../../models/QuizAttempt';
import { Course } from '../../models/Course';
import { UserCompetency } from '../../models/UserCompetency';
import { SkillGap } from '../../models/SkillGap';
import { skillGapService } from '../skillGap/skillGap.service';

/** Admin analytics (prompt §33) — deterministic aggregations. */
export const analyticsService = {
  async adminDashboard() {
    const { adminInsightsService } = await import('./adminInsights.service');
    const [totalUsers, activeUsers, learners, trainers, courses, enrollments, completions, attempts, activities, avgComp, avgQuiz, topGaps, deptHeatmap, popularity, activityByDay, departments, openGapUsers, learnerIds] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: 'LEARNER' }),
        User.countDocuments({ role: 'TRAINER' }),
        Course.countDocuments({ isActive: true }),
        Enrollment.countDocuments({}),
        Enrollment.countDocuments({ status: 'COMPLETED' }),
        QuizAttempt.countDocuments({}),
        LearningActivity.countDocuments({}),
        UserCompetency.aggregate([{ $group: { _id: null, avg: { $avg: '$currentScore' } } }]),
        QuizAttempt.aggregate([{ $group: { _id: null, avg: { $avg: '$score' } } }]),
        skillGapService.aggregatedTopGaps(8),
        this.departmentCompetencyHeatmap(),
        this.coursePopularity(8),
        this.learningActivitySeries(14),
        User.distinct('department', { role: 'LEARNER' }),
        SkillGap.distinct('userId', { gap: { $gt: 0 } }),
        User.find({ role: 'LEARNER', isActive: true }).select('_id').then((docs) => docs.map((d) => String(d._id))),
      ]);
    const enriched = await adminInsightsService.enrichUsers(learnerIds);
    const readinessValues = [...enriched.values()].map((e) => e.readiness);
    const meanReadiness = readinessValues.length
      ? readinessValues.reduce((a, b) => a + b, 0) / readinessValues.length
      : 0;

    return {
      users: { total: totalUsers, active: activeUsers, learners, trainers },
      courses: { total: courses },
      enrollments: { total: enrollments, completed: completions, completionRate: enrollments ? Math.round((completions / enrollments) * 100) : 0 },
      quizzes: { attempts },
      activities: { total: activities },
      avgCompetencyScore: Math.round((avgComp[0]?.avg ?? 0) * 10) / 10,
      avgQuizScore: Math.round((avgQuiz[0]?.avg ?? 0) * 10) / 10,
      topSkillGaps: topGaps,
      departmentCompetency: deptHeatmap,
      coursePopularity: popularity,
      learningActivityByDay: activityByDay,
      // Flat overview tiles for the workforce analytics header.
      overview: {
        officers: learners,
        divisions: departments.filter(Boolean).length,
        meanReadiness: Math.round(meanReadiness * 1000) / 1000,
        officersWithGaps: openGapUsers.length,
        quizzesTaken: attempts,
        coursesEnrolled: enrollments,
      },
    };
  },

  /** Department × competency average score heatmap. */
  async departmentCompetencyHeatmap(limitDepts = 12) {
    const users = await User.find({ role: 'LEARNER', isActive: true }).select('_id department');
    const userDept = new Map(users.map((u) => [String(u._id), u.department ?? 'Unassigned']));
    const rows = await UserCompetency.aggregate([
      { $match: { userId: { $in: users.map((u) => u._id) } } },
      {
        $lookup: {
          from: 'competencies',
          localField: 'competencyId',
          foreignField: '_id',
          as: 'competency',
        },
      },
      { $unwind: '$competency' },
      {
        $group: {
          _id: { dept: '$userId', code: '$competency.code' },
          avg: { $avg: '$currentScore' },
        },
      },
    ]);
    // Re-key by actual department names.
    const byDeptCode = new Map<string, { total: number; count: number }>();
    for (const r of rows) {
      const dept = userDept.get(String(r._id.dept)) ?? 'Unassigned';
      const key = `${dept}||${r._id.code}`;
      const cur = byDeptCode.get(key) ?? { total: 0, count: 0 };
      cur.total += r.avg;
      cur.count += 1;
      byDeptCode.set(key, cur);
    }
    const heat: Record<string, Record<string, number>> = {};
    for (const [key, v] of byDeptCode) {
      const [dept, code] = key.split('||');
      heat[dept] = heat[dept] ?? {};
      heat[dept][code] = Math.round(v.total / v.count);
    }
    return Object.fromEntries(Object.entries(heat).slice(0, limitDepts));
  },

  async coursePopularity(limit = 8) {
    return Course.find({ isActive: true })
      .sort({ enrollmentCount: -1 })
      .limit(limit)
      .select('title provider enrollmentCount rating level');
  },

  async learningActivitySeries(days = 14) {
    const since = new Date(Date.now() - days * 86400000);
    return LearningActivity.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          xp: { $sum: '$xpAwarded' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1, xp: 1 } },
    ]);
  },

  async trainerAnalytics(trainerId: string) {
    const { Quiz } = await import('../../models/Quiz');
    const quizzes = await Quiz.find({ createdBy: trainerId }).select('_id title status attemptCount questions.topic');
    const quizIds = quizzes.map((q) => q._id);
    const attempts = await QuizAttempt.find({ quizId: { $in: quizIds } });
    const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
    const topicMap = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      for (const t of a.topicPerformance) {
        const cur = topicMap.get(t.topic) ?? { correct: 0, total: 0 };
        cur.correct += t.correct;
        cur.total += t.total;
        topicMap.set(t.topic, cur);
      }
    }
    return {
      quizzes: quizzes.map((q) => ({ id: q._id, title: q.title, status: q.status, attempts: q.attemptCount, questions: q.questions.length })),
      totalAttempts: attempts.length,
      avgScore,
      topicPerformance: [...topicMap.entries()]
        .map(([topic, t]) => ({ topic, percent: t.total ? Math.round((t.correct / t.total) * 100) : 0 }))
        .sort((a, b) => a.percent - b.percent),
    };
  },
};
