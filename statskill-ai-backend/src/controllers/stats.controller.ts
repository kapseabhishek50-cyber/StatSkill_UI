import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { Competency } from '../models/Competency';
import { Course } from '../models/Course';
import { Role } from '../models/Role';
import { Assessment } from '../models/Assessment';
import { QuizAttempt } from '../models/QuizAttempt';
import { UserCompetency } from '../models/UserCompetency';
import { Community } from '../models/Community';
import { aiStatus } from '../services/ai/ai.service';
import { databaseHealth } from '../config/database';

/**
 * GET /api/stats/public — live platform counts for the public landing page.
 * No auth; aggregates only, no personal data.
 */
export const statsController = {
  publicStats: asyncHandler(async (_req: Request, res: Response) => {
    const [
      officers,
      competencies,
      courses,
      departments,
      jobRoles,
      assessments,
      quizzes,
      competencyRecords,
      communities,
      taxonomy,
      categories,
      topCourses,
      db,
    ] = await Promise.all([
      User.countDocuments({ role: 'LEARNER', isActive: true }),
      Competency.countDocuments({ isActive: true }),
      Course.countDocuments({ isActive: true }),
      User.distinct('department', { isActive: true }),
      Role.countDocuments({ isActive: true }),
      Assessment.countDocuments({}),
      QuizAttempt.countDocuments({}),
      UserCompetency.countDocuments({}),
      Community.countDocuments({ isActive: true }),
      Competency.find({ isActive: true }).select('code name category').sort({ name: 1 }).lean(),
      Competency.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ]),
      Course.find({ isActive: true })
        .select('title provider rating durationHours')
        .sort({ enrollmentCount: -1 })
        .limit(5)
        .lean(),
      databaseHealth(),
    ]);

    sendSuccess(
      res,
      {
        live: true,
        source: 'database',
        stats: {
          officers,
          competencies,
          courses,
          departments: departments.filter(Boolean).length,
          jobRoles,
          assessments,
          quizzes,
          competencyRecords,
          communities,
        },
        competencies: taxonomy,
        categories,
        courses: topCourses.map((c) => ({
          title: c.title,
          provider: c.provider,
          rating: c.rating,
          durationHours: c.durationHours,
        })),
        health: { db: db.connected ? 'up' : 'down', llmProvider: aiStatus().provider ?? 'mock' },
      },
      'Public platform statistics'
    );
  }),
};
