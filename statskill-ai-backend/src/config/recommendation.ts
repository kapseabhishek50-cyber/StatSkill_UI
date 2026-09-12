import { env } from './env';
import { normalizeWeights } from '../utils/math';

export type RecommendationWeightKey =
  | 'gap'
  | 'role'
  | 'semantic'
  | 'difficulty'
  | 'history'
  | 'popularity'
  | 'freshness';

/**
 * Hybrid recommendation weights — configurable via environment, normalized at
 * runtime. NEVER hardcode these inside controllers or services.
 */
export const recommendationWeights: Record<RecommendationWeightKey, number> = normalizeWeights({
  gap: env.REC_WEIGHT_GAP,
  role: env.REC_WEIGHT_ROLE,
  semantic: env.REC_WEIGHT_SEMANTIC,
  difficulty: env.REC_WEIGHT_DIFFICULTY,
  history: env.REC_WEIGHT_HISTORY,
  popularity: env.REC_WEIGHT_POPULARITY,
  freshness: env.REC_WEIGHT_FRESHNESS,
});

export const recommendationConfig = {
  weights: recommendationWeights,
  topN: env.REC_TOP_N,
  candidatePool: env.REC_CANDIDATE_POOL,
  excludeEnrolled: env.REC_EXCLUDE_ENROLLED,
  excludeCompleted: env.REC_EXCLUDE_COMPLETED,
  /** Courses whose embedding text changed more than this are re-embedded. */
  embeddingStaleAfterDays: 7,
  /** Recommendation docs older than this are marked EXPIRED on next read. */
  recommendationsValidDays: 14,
  /** Level target: officers with fewer years aim lower by default. */
  experienceLevelThresholds: { beginnerMaxYears: 3, advancedMinYears: 8 } as Record<string, number>,
};

export default recommendationConfig;
