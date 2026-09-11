import {
  MAX_LEVEL,
  MIN_LEVEL,
  PRIORITY_WEIGHTS,
  priorityBand,
} from '../config/competency.js';

/**
 * The gap engine.
 *
 * Two functions carry the whole model:
 *
 *   normalisedGap(required, current)
 *     = max(0, required - current) / (MAX_LEVEL - MIN_LEVEL)     -> 0..1
 *
 *   priority = gap x (w1*roleImportance + w2*departmentPriority + w3*futureDemand)
 *
 * The gap is a multiplicative GATE, the three context factors a weighted SUM.
 * That combination is deliberate:
 *
 *   - No gap means no recommendation, always. A competency the learner already
 *     meets can never surface, whatever its importance.
 *   - max(0, ...) clamps the over-qualified case. Plain (required - current)
 *     goes negative and, multiplied through, flips the sign of everything
 *     downstream - a level-5 expert would out-rank a level-1 novice.
 *   - Because the weights sum to 1 and every factor is 0..1, priority stays in
 *     0..1. Scores are comparable across learners, roles and departments, and
 *     each term can be defended on its own.
 *
 * Multiplying all four factors instead (gap x importance x dept x demand) is
 * the tempting shorthand and it breaks: any single zero wipes the score, and
 * the product of four sub-1 numbers compresses everything toward zero, so
 * ranking becomes arbitrary.
 */

const LEVEL_SPAN = MAX_LEVEL - MIN_LEVEL;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalisedGap(requiredLevel, currentLevel) {
  const raw = Math.max(0, (requiredLevel ?? 0) - (currentLevel ?? 0));
  return clamp01(raw / LEVEL_SPAN);
}

export function contextScore(
  { roleImportance = 0.5, departmentPriority = 0.5, futureDemand = 0.5 },
  weights = PRIORITY_WEIGHTS,
) {
  return clamp01(
    weights.roleImportance * clamp01(roleImportance) +
      weights.departmentPriority * clamp01(departmentPriority) +
      weights.futureDemand * clamp01(futureDemand),
  );
}

export function priorityScore(input, weights = PRIORITY_WEIGHTS) {
  const gap = normalisedGap(input.requiredLevel, input.currentLevel);
  if (gap === 0) return 0;
  return clamp01(gap * contextScore(input, weights));
}

/**
 * Scores every requirement of a job role against a learner's current levels.
 *
 * @param {object}   args
 * @param {Array}    args.requirements  JobRole.requirements, competency populated.
 * @param {Map}      args.currentLevels competencyId -> currentLevel.
 * @param {number}   args.departmentPriority 0..1
 * @param {object}  [args.weights]
 * @returns {Array} one row per requirement, highest priority first.
 */
export function computeGaps({ requirements, currentLevels, departmentPriority = 0.5, weights }) {
  const rows = requirements.map((requirement) => {
    const competency = requirement.competency;
    const competencyId = String(competency?._id ?? competency);
    const currentLevel = currentLevels.get(competencyId) ?? MIN_LEVEL;
    const requiredLevel = requirement.requiredLevel;

    const input = {
      requiredLevel,
      currentLevel,
      roleImportance: requirement.importance,
      departmentPriority,
      futureDemand: competency?.futureDemand ?? 0.5,
    };

    const gap = normalisedGap(requiredLevel, currentLevel);
    const priority = priorityScore(input, weights);

    return {
      competencyId,
      competency,
      currentLevel,
      requiredLevel,
      levelsShort: Math.max(0, requiredLevel - currentLevel),
      gap: round(gap),
      priority: round(priority),
      band: priorityBand(priority),
      mandatory: Boolean(requirement.mandatory),
      roleImportance: requirement.importance ?? 0.5,
      futureDemand: competency?.futureDemand ?? 0.5,
      departmentPriority,
      // Everything above is reproducible from these numbers - the UI shows this
      // rather than asserting "AI decided".
      explanation:
        `gap ${round(gap)} x context ${round(contextScore(input, weights))} = priority ${round(priority)}`,
    };
  });

  // Mandatory-but-unmet requirements float to the top of their priority band so
  // a statutory requirement is never buried by a higher-scoring optional one.
  return rows.sort((a, b) => {
    if (a.mandatory !== b.mandatory && (a.gap > 0) === (b.gap > 0)) {
      return a.mandatory ? -1 : 1;
    }
    return b.priority - a.priority;
  });
}

/** Rows the learner still has work to do on. */
export function openGaps(rows) {
  return rows.filter((row) => row.gap > 0);
}

/**
 * Headline readiness: how much of the role's weighted requirement the learner
 * currently meets, 0..1. Weighted by importance so missing a core competency
 * costs more than missing a peripheral one.
 */
export function roleReadiness(rows) {
  const totalWeight = rows.reduce((sum, r) => sum + (r.roleImportance ?? 0.5) * r.requiredLevel, 0);
  if (totalWeight === 0) return 1;
  const met = rows.reduce(
    (sum, r) => sum + (r.roleImportance ?? 0.5) * Math.min(r.currentLevel, r.requiredLevel),
    0,
  );
  return round(met / totalWeight);
}

function round(value, places = 4) {
  return Number(value.toFixed(places));
}
