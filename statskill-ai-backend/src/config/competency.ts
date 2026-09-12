import { env } from './env';

export type GapPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Skill-gap priority thresholds — configurable (prompt §5). */
export const GAP_THRESHOLDS = {
  CRITICAL: env.GAP_CRITICAL,
  HIGH: env.GAP_HIGH,
  MEDIUM: env.GAP_MEDIUM,
} as const;

export const priorityForGap = (gap: number): GapPriority => {
  if (gap >= GAP_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (gap >= GAP_THRESHOLDS.HIGH) return 'HIGH';
  if (gap >= GAP_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
};

export type CompetencyCategory =
  | 'STATISTICAL'
  | 'TECHNICAL'
  | 'DIGITAL_GOVERNANCE'
  | 'BEHAVIOURAL';

export const COMPETENCY_CATEGORIES: CompetencyCategory[] = [
  'STATISTICAL',
  'TECHNICAL',
  'DIGITAL_GOVERNANCE',
  'BEHAVIOURAL',
];

/** Competency score update policy (prompt §27) — deterministic, never LLM-driven. */
export const competencyUpdateConfig = {
  mode: env.COMPETENCY_UPDATE_MODE,
  /** Weight of the freshly observed score when assessments re-measure a competency. */
  assessmentObservedWeight: env.ASSESSMENT_OBSERVED_WEIGHT,
  /** Quiz results can only *improve* a score, blended by this weight. */
  quizImproveWeight: env.QUIZ_IMPROVE_WEIGHT,
  /** Small bump on course completion (courses alone are weaker evidence than tests). */
  courseCompletionBoost: 2,
};

export const confidenceFor = (correct: number, total: number): number => {
  if (total <= 0) return 0;
  // Wilson-style lower bound keeps low-sample scores humble.
  const z = 1.96;
  const p = correct / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return Math.round(Math.max(0, Math.min(1, (centre - margin) / denom)) * 100) / 100;
};
