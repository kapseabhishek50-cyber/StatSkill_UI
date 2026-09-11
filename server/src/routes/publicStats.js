import { Router } from 'express';
import mongoose from 'mongoose';
import {
  User,
  Competency,
  Course,
  Department,
  JobRole,
  Assessment,
  QuizResult,
  UserCompetency,
  DiscussionGroup,
} from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { llmProviderName } from '../services/llm/index.js';
import {
  competencies as seedCompetencies,
  courses as seedCourses,
  demoUsers,
  departments as seedDepartments,
  jobRoles as seedJobRoles,
  officerRoster,
  discussionGroups as seedDiscussionGroups,
} from '../seed/data.js';

/**
 * Public, unauthenticated platform snapshot for the landing page.
 *
 * This is the one endpoint that makes the public website dynamic: the marketing
 * numbers on the landing page are read from the database on every request, so
 * they move as the workforce grows. When the database is unreachable the route
 * still answers 200 with the seed snapshot and `live: false`, so the site never
 * shows an error to a visitor.
 */
const router = Router();

function fromSeed() {
  return {
    live: false,
    source: 'snapshot',
    generatedAt: new Date().toISOString(),
    stats: {
      officers: demoUsers.length + officerRoster.length,
      competencies: seedCompetencies.length,
      courses: seedCourses.length,
      departments: seedDepartments.length,
      jobRoles: seedJobRoles.length,
      assessments: 0,
      quizzes: 0,
      competencyRecords: 0,
      communities: seedDiscussionGroups.length,
    },
    competencies: seedCompetencies
      .slice(0, 16)
      .map(({ code, name, category, futureDemand }) => ({ code, name, category, futureDemand })),
    categories: Object.entries(
      seedCompetencies.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([category, count]) => ({ category, count })),
    courses: seedCourses.slice(0, 12).map(({ code, title, provider, rating, durationHours }) => ({
      code,
      title,
      provider,
      rating,
      durationHours,
    })),
    health: { db: 'down', llmProvider: llmProviderName() },
  };
}

router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    if (mongoose.connection.readyState !== 1) {
      res.json(fromSeed());
      return;
    }

    try {
      const [officers, competencies, courses, departments, jobRoles, assessments, quizzes, competencyRecords, communities] =
        await Promise.all([
          User.countDocuments(),
          Competency.countDocuments(),
          Course.countDocuments({ isActive: { $ne: false } }),
          Department.countDocuments(),
          JobRole.countDocuments(),
          Assessment.countDocuments(),
          QuizResult.countDocuments(),
          UserCompetency.countDocuments(),
          DiscussionGroup.countDocuments(),
        ]);

      const competencyDocs = await Competency.find()
        .select('code name category futureDemand')
        .sort({ futureDemand: -1, code: 1 })
        .limit(16)
        .lean();

      const courseDocs = await Course.find({ isActive: { $ne: false } })
        .select('code title provider rating durationHours')
        .sort({ rating: -1, enrolments: -1 })
        .limit(12)
        .lean();

      const categoryCounts = await Competency.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      res.json({
        live: true,
        source: 'database',
        generatedAt: new Date().toISOString(),
        stats: {
          officers,
          competencies,
          courses,
          departments,
          jobRoles,
          assessments,
          quizzes,
          competencyRecords,
          communities,
        },
        competencies: competencyDocs.map(({ code, name, category, futureDemand }) => ({
          code,
          name,
          category,
          futureDemand,
        })),
        categories: categoryCounts.map(({ _id, count }) => ({ category: _id, count })),
        courses: courseDocs,
        health: { db: 'up', llmProvider: llmProviderName() },
      });
    } catch {
      // A flapping database should never break the public page.
      res.json(fromSeed());
    }
  }),
);

export default router;
