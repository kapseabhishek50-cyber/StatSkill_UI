/**
 * Domain constants for the competency model.
 *
 * Everything downstream - gap scores, priority ranking, course matching, quiz
 * difficulty - is defined against this one ordinal scale. Change it here only.
 */

export const MIN_LEVEL = 0;
export const MAX_LEVEL = 5;

/**
 * Proficiency scale. Ordinal, not interval: level 4 is not "twice" level 2.
 * Descriptors are what a reviewer reads, so they are behavioural, not vague.
 */
export const PROFICIENCY_LEVELS = [
  { level: 0, label: 'None', descriptor: 'No exposure to the competency.' },
  { level: 1, label: 'Awareness', descriptor: 'Knows the concepts and vocabulary; cannot yet apply them.' },
  { level: 2, label: 'Basic', descriptor: 'Performs routine tasks under supervision, using set procedures.' },
  { level: 3, label: 'Proficient', descriptor: 'Works independently on standard tasks; handles common exceptions.' },
  { level: 4, label: 'Advanced', descriptor: 'Handles non-standard problems; reviews and corrects others’ work.' },
  { level: 5, label: 'Expert', descriptor: 'Sets methodology and standards; trains and mentors across units.' },
];

export function levelLabel(level) {
  return PROFICIENCY_LEVELS.find((l) => l.level === level)?.label ?? 'Unknown';
}

export const COMPETENCY_CATEGORIES = ['domain', 'technical', 'digital', 'behavioural'];

/**
 * Priority weights. The gap is a multiplicative gate (no gap => never
 * recommended); these three weights distribute the *contextual* importance and
 * must sum to 1 so the final priority stays inside 0..1 and stays comparable
 * across roles and departments.
 */
export const PRIORITY_WEIGHTS = {
  roleImportance: 0.5,
  departmentPriority: 0.2,
  futureDemand: 0.3,
};

const weightSum = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`PRIORITY_WEIGHTS must sum to 1, got ${weightSum}`);
}

/**
 * Priority bands. Thresholds are on the 0..1 priority score, so a band means
 * the same thing for every learner - it is not a per-user percentile.
 */
export const PRIORITY_BANDS = [
  { band: 'critical', min: 0.5, label: 'Critical' },
  { band: 'high', min: 0.3, label: 'High' },
  { band: 'moderate', min: 0.15, label: 'Moderate' },
  { band: 'low', min: 0, label: 'Low' },
];

export function priorityBand(score) {
  return PRIORITY_BANDS.find((b) => score >= b.min)?.band ?? 'low';
}

/** A quiz must clear this to count as evidence of the target level. */
export const QUIZ_PASS_RATIO = 0.7;
