import { COMPETENCY_TAXONOMY } from './competencyTaxonomy';
import { MOCK_COURSES } from './mockCourses';
import { ROLE_SEED } from './roles';

/** Stable public identifier for a course that has no external ID. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/**
 * Offline snapshot of the public platform numbers.
 *
 * `GET /api/stats/public` serves the landing page. When MongoDB cannot be
 * reached the route must still answer 200 — a marketing page should never show
 * a visitor an error — so it falls back to this snapshot, which is derived from
 * the bundled seed data the platform ships with (taxonomy, demo catalogue, role
 * matrix). It is always labelled `live: false` / `source: 'snapshot'`, so the UI
 * can show it without ever claiming the numbers are real.
 *
 * Counts that describe *usage* (assessments taken, quiz attempts, measured
 * competency scores, communities joined) are deliberately zero here: on a fresh
 * install that database is genuinely empty, and inventing traffic for a public
 * page is the one thing this endpoint must not do.
 */
export interface PlatformCounts {
  officers: number;
  competencies: number;
  courses: number;
  departments: number;
  jobRoles: number;
  assessments: number;
  quizzes: number;
  competencyRecords: number;
  communities: number;
}

/** Framework/catalogue size is known from the bundled seed data. */
export const SNAPSHOT_COUNTS: PlatformCounts = {
  officers: 0,
  competencies: COMPETENCY_TAXONOMY.length,
  courses: MOCK_COURSES.length,
  departments: 0,
  jobRoles: ROLE_SEED.length,
  assessments: 0,
  quizzes: 0,
  competencyRecords: 0,
  communities: 0,
};

/** Competency ticker items for the landing page, from the shipped taxonomy. */
export const SNAPSHOT_COMPETENCIES = COMPETENCY_TAXONOMY.slice(0, 16).map(({ code, name, category }) => ({
  code,
  name,
  category,
}));

/** Category distribution, computed from the taxonomy so it can never drift. */
export const SNAPSHOT_CATEGORIES = Object.entries(
  COMPETENCY_TAXONOMY.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([category, count]) => ({ category, count }))
  .sort((a, b) => b.count - a.count);

/** Highest-rated demo courses, mirroring the live query's ordering. */
export const SNAPSHOT_COURSES = [...MOCK_COURSES]
  .sort((a, b) => b.rating - a.rating || b.enrollmentCount - a.enrollmentCount)
  .slice(0, 12)
  .map((course) => ({
    code: course.externalId ?? slugify(course.title),
    title: course.title,
    provider: course.provider,
    rating: course.rating,
    durationHours: course.durationHours,
    level: course.level,
  }));

