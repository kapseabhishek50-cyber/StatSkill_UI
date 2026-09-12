import { ICourse } from '../../models/Course';
import { normalizeGapScore } from '../competency/competencyScore.service';
import { recommendationConfig } from '../../config/recommendation';
import { cosineSimilarity, clamp } from '../../utils/math';
import { monthsBetween } from '../../utils/date';

/**
 * Deterministic scoring components (prompt §8-10). Every component ∈ [0,1].
 * Pure functions — fully unit-testable, no I/O.
 */

export interface CourseGapContext {
  /** competencyCode → { current, required, gap } for the learner */
  gapByCode: Map<string, { current: number; required: number; gap: number }>;
}

export interface RoleContext {
  /** competencyCode → requiredScore/100 importance from the role matrix */
  roleByCode: Map<string, { requiredScore: number; weight: number }>;
}

/** §9: strongest normalized gap across the course's skills. */
export const computeGapScore = (course: ICourse, ctx: CourseGapContext): number => {
  let best = 0;
  for (const skill of course.skills) {
    const g = ctx.gapByCode.get(skill);
    if (g) best = Math.max(best, normalizeGapScore(g.gap));
  }
  return best;
};

/** §10: how relevant the course's skills are to the learner's role (DB-driven mapping). */
export const computeRoleMatch = (course: ICourse, ctx: RoleContext): number => {
  if (!course.skills.length) return 0.3; // neutral for untagged courses
  let sum = 0;
  let counted = 0;
  for (const skill of course.skills) {
    const r = ctx.roleByCode.get(skill);
    if (r) {
      sum += (r.requiredScore / 100) * (r.weight ?? 1);
      counted += 1;
    }
  }
  if (counted === 0) return 0.2; // skills outside the role's domain
  return clamp(sum / counted);
};

/** §11: cosine similarity between learner profile vector and course vector. */
export const computeSemanticScore = (userVector: number[] | null, courseVector: number[] | null): number => {
  if (!userVector?.length || !courseVector?.length) return 0;
  return clamp(cosineSimilarity(userVector, courseVector));
};

const LEVEL_ORDER: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

/** Difficulty fit: rewards courses slightly above the learner's current level. */
export const computeDifficultyMatch = (course: ICourse, targetLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'): number => {
  const diff = Math.abs((LEVEL_ORDER[course.level] ?? 1) - (LEVEL_ORDER[targetLevel] ?? 1));
  return clamp(1 - diff / 2);
};

/** §8: learning history — similarity with courses the learner already completed (coherent upskilling). */
export const computeHistoryScore = (
  courseVector: number[] | null,
  completedVectors: number[][]
): number => {
  if (!courseVector?.length || !completedVectors.length) return 0;
  let max = 0;
  for (const v of completedVectors) max = Math.max(max, cosineSimilarity(courseVector, v));
  return clamp(max);
};

/** Popularity: log-scaled enrollments blended with rating. */
export const computePopularity = (course: ICourse, maxEnrollment: number): number => {
  const enrollmentNorm =
    maxEnrollment > 0 ? Math.log1p(course.enrollmentCount) / Math.log1p(maxEnrollment) : 0;
  const ratingNorm = course.rating / 5;
  return clamp(0.6 * enrollmentNorm + 0.4 * ratingNorm);
};

/** Freshness: gentle recency decay over ~6 months. */
export const computeFreshness = (course: ICourse, now = new Date()): number => {
  const ref = course.lastSyncedAt ?? course.updatedAt ?? course.createdAt;
  const months = monthsBetween(new Date(ref), now);
  return clamp(1 / (1 + months / 6));
};

export interface ScoreBreakdown {
  gap: number;
  role: number;
  semantic: number;
  difficulty: number;
  history: number;
  popularity: number;
  freshness: number;
  final: number; // weighted 0-1
}

export const computeFinalScore = (
  components: Omit<ScoreBreakdown, 'final'>,
  weights: Record<string, number> = recommendationConfig.weights as unknown as Record<string, number>
): ScoreBreakdown => ({
  ...components,
  final:
    components.gap * (weights.gap ?? 0.35) +
    components.role * (weights.role ?? 0.2) +
    components.semantic * (weights.semantic ?? 0.2) +
    components.difficulty * (weights.difficulty ?? 0.1) +
    components.history * (weights.history ?? 0.05) +
    components.popularity * (weights.popularity ?? 0.05) +
    components.freshness * (weights.freshness ?? 0.05),
});

/** Learner target level from experience (configurable thresholds). */
export const targetLevelForExperience = (years = 0): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' => {
  const t = recommendationConfig.experienceLevelThresholds;
  if (years >= (t.advancedMinYears ?? 8)) return 'ADVANCED';
  if (years >= (t.beginnerMaxYears ?? 3)) return 'INTERMEDIATE';
  return 'BEGINNER';
};
