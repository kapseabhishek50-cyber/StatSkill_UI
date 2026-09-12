import { GAP_THRESHOLDS, priorityForGap, confidenceFor } from '../../config/competency';

/** Pure scoring helpers — unit tested, deterministic. */

export const computeGap = (currentScore: number, requiredScore: number): number =>
  Math.max(0, Math.round(requiredScore - currentScore));

export const computePriority = (gap: number): string => priorityForGap(gap);

export const isCritical = (gap: number): boolean => gap >= GAP_THRESHOLDS.CRITICAL;

/** Gap normalized to [0,1] for the recommendation engine (prompt §9). */
export const normalizeGapScore = (gap: number): number =>
  Math.max(0, Math.min(1, gap / 100));

export { confidenceFor };
