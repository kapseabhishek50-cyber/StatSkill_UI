import mongoose from 'mongoose';
import { User } from '../../models/User';
import { Role } from '../../models/Role';
import { Competency } from '../../models/Competency';
import { UserCompetency } from '../../models/UserCompetency';
import { Assessment } from '../../models/Assessment';
import { QuizAttempt } from '../../models/QuizAttempt';
import { Community } from '../../models/Community';
import { Course } from '../../models/Course';
import { env } from '../../config/env';
import { getLogger } from '../../utils/logger';
import { aiStatus } from '../ai/ai.service';
import {
  PlatformCounts,
  SNAPSHOT_CATEGORIES,
  SNAPSHOT_COMPETENCIES,
  SNAPSHOT_COUNTS,
  SNAPSHOT_COURSES,
  slugify,
} from '../../data/platformSnapshot';

/**
 * Public platform snapshot for the landing page.
 *
 * This is the read-side of "the numbers you see are the numbers in the
 * database": every figure is a count against Mongo, computed on request. Two
 * properties matter more than anything else here:
 *
 * 1. It never fails. A flapping database returns the bundled seed snapshot with
 *    `live: false` rather than a 500, because this payload feeds a public
 *    marketing page and a visitor must never see an error.
 * 2. It never leaks. Only aggregate counts, competency names and public course
 *    metadata are returned — no officer names, emails, departments of specific
 *    people, scores or anything else attributable.
 */

export interface PublicCourse {
  code: string;
  title: string;
  provider: string;
  rating: number;
  durationHours: number;
  level: string;
}

export interface PublicCompetency {
  code: string;
  name: string;
  category: string;
}

export interface PublicCategoryCount {
  category: string;
  count: number;
}

export interface PublicStatsPayload {
  live: boolean;
  source: 'database' | 'snapshot';
  generatedAt: string;
  stats: PlatformCounts;
  competencies: PublicCompetency[];
  categories: PublicCategoryCount[];
  courses: PublicCourse[];
  health: { db: 'up' | 'down'; aiProvider: string; aiConfigured: boolean };
}

const log = getLogger('publicStats');

const COMPETENCY_LIMIT = 16;
const COURSE_LIMIT = 12;

/** Non-attributable department list: the set of departments with members, not who is in them. */
const distinctDepartments = async (): Promise<string[]> => {
  const values = await User.distinct('department', {
    department: { $exists: true, $nin: [null, ''] },
  });
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
};

const buildFromDatabase = async (): Promise<PublicStatsPayload> => {
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
  ] = await Promise.all([
    // "Officers onboarded" counts enabled accounts only — a deactivated officer is
    // not being onboarded, and the landing page should not imply otherwise.
    User.countDocuments({ isActive: true }),
    Competency.countDocuments({ isActive: true }),
    Course.countDocuments({ isActive: true }),
    distinctDepartments(),
    Role.countDocuments({ isActive: true }),
    Assessment.countDocuments({ status: 'COMPLETED' }),
    QuizAttempt.countDocuments({}),
    UserCompetency.countDocuments({}),
    Community.countDocuments({ isActive: true }),
  ]);

  const [competencyDocs, courseDocs, categoryCounts] = await Promise.all([
    Competency.find({ isActive: true })
      .select('code name category')
      .sort({ category: 1, code: 1 })
      .limit(COMPETENCY_LIMIT)
      .lean(),
    Course.find({ isActive: true })
      .select('externalId title provider rating durationHours level')
      .sort({ rating: -1, enrollmentCount: -1 })
      .limit(COURSE_LIMIT)
      .lean(),
    Competency.aggregate<PublicCategoryCount & { _id: string }>([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    live: true,
    source: 'database',
    generatedAt: new Date().toISOString(),
    stats: {
      officers,
      competencies,
      courses,
      departments: departments.length,
      jobRoles,
      assessments,
      quizzes,
      competencyRecords,
      communities,
    },
    competencies: competencyDocs.map(({ code, name, category }) => ({ code, name, category })),
    categories: categoryCounts.map(({ _id, count }) => ({ category: _id, count })),
    courses: courseDocs.map((course) => ({
      code: course.externalId || slugify(course.title),
      title: course.title,
      provider: course.provider,
      rating: course.rating,
      durationHours: course.durationHours,
      level: course.level,
    })),
    health: { db: 'up', ...aiHealth() },
  };
};

const aiHealth = () => {
  const { provider, configured } = aiStatus();
  return { aiProvider: provider, aiConfigured: configured };
};

const buildFromSeed = (): PublicStatsPayload => ({
  live: false,
  source: 'snapshot',
  generatedAt: new Date().toISOString(),
  stats: SNAPSHOT_COUNTS,
  competencies: SNAPSHOT_COMPETENCIES,
  categories: SNAPSHOT_CATEGORIES,
  courses: SNAPSHOT_COURSES,
  // No error detail is forwarded: this payload is public and a connection
  // string or driver message must never reach a browser. It is logged instead.
  health: { db: 'down', ...aiHealth() },
});

/**
 * Short-lived in-process cache.
 *
 * The landing page polls once a minute per visitor. Under a spike that is a lot
 * of near-identical aggregate queries for numbers that move on the scale of
 * minutes, so concurrent and repeat requests reuse one computation. TTL is
 * configurable and 0 disables caching entirely.
 */
let cached: { payload: PublicStatsPayload; expiresAt: number } | null = null;
let inFlight: Promise<PublicStatsPayload> | null = null;

const cacheTtlMs = () => Math.max(0, env.PUBLIC_STATS_CACHE_TTL_SEC) * 1000;

const compute = async (): Promise<PublicStatsPayload> => {
  if (mongoose.connection.readyState !== 1) {
    log.debug('mongo not connected — serving seed snapshot for /stats/public');
    return buildFromSeed();
  }
  try {
    return await buildFromDatabase();
  } catch (err) {
    // A flapping database or a partially populated collection must never break the public page.
    log.warn({ err }, 'stats aggregation failed — serving seed snapshot');
    return buildFromSeed();
  }
};

export const publicStatsService = {
  async snapshot(): Promise<PublicStatsPayload> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.payload;

    // Single-flight: collapse a burst of page loads into one set of queries.
    if (inFlight) return inFlight;

    inFlight = compute()
      .then((payload) => {
        const ttl = cacheTtlMs();
        cached = ttl > 0 ? { payload, expiresAt: Date.now() + ttl } : null;
        return payload;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  },

  /** Test/ops hook: drop the cached payload so the next request recomputes. */
  invalidate(): void {
    cached = null;
  },
};

export default publicStatsService;
