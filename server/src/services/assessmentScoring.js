import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';
import { UserCompetency } from '../models/UserCompetency.js';

/**
 * Turning evidence into a recorded level.
 *
 * Three sources write a level, and they are not equally trustworthy, so each
 * carries a confidence and a precedence. The rule is simple and stated once here
 * rather than reimplemented per route:
 *
 *   - A self-rating is accepted, but discounted, and never overwrites a level
 *     that was earned by quiz unless the officer is rating themselves lower.
 *   - A passed quiz is authoritative for the level it tested.
 *   - An admin override wins outright, because a human has taken responsibility.
 *
 * Every write appends to `history`, so a level can be explained after the fact
 * instead of just observed.
 */

export const CONFIDENCE = {
  self_reported: 0.4,
  assessment: 0.6,
  quiz: 0.9,
  admin_override: 1,
};

const PRECEDENCE = { self_reported: 1, assessment: 2, quiz: 3, admin_override: 4 };

function clampLevel(level) {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(Number(level) || 0)));
}

/**
 * Decides whether `incoming` evidence should replace what is on record.
 *
 * A lower self-rating is allowed through on purpose: an officer correcting an
 * over-statement is useful information, and refusing it would let one optimistic
 * assessment lock a level in permanently.
 */
export function shouldReplace(existing, incoming) {
  if (!existing) return true;
  if (PRECEDENCE[incoming.evidence] > PRECEDENCE[existing.evidence]) return true;
  if (PRECEDENCE[incoming.evidence] < PRECEDENCE[existing.evidence]) {
    return incoming.level < existing.currentLevel;
  }
  return incoming.level !== existing.currentLevel;
}

/**
 * Records a level for one competency, honouring precedence.
 * @returns {{ record, changed: boolean, levelBefore: number|null }}
 */
export async function recordLevel({ user, competency, level, evidence, note }) {
  const nextLevel = clampLevel(level);
  const existing = await UserCompetency.findOne({ user, competency });
  const levelBefore = existing?.currentLevel ?? null;

  if (!shouldReplace(existing, { level: nextLevel, evidence })) {
    return { record: existing, changed: false, levelBefore };
  }

  const entry = { level: nextLevel, evidence, at: new Date(), note };

  const record = await UserCompetency.findOneAndUpdate(
    { user, competency },
    {
      $set: { currentLevel: nextLevel, evidence, confidence: CONFIDENCE[evidence] ?? 0.4 },
      $push: { history: entry },
      $setOnInsert: { user, competency },
    },
    { new: true, upsert: true },
  );

  return { record, changed: true, levelBefore };
}

/**
 * Applies a whole self-assessment. Returns per-competency outcomes so the route
 * can tell the officer what actually moved rather than claiming everything did.
 */
export async function applySelfAssessment({ user, responses }) {
  const outcomes = [];

  for (const response of responses) {
    const { record, changed, levelBefore } = await recordLevel({
      user,
      competency: response.competency,
      level: response.selfLevel,
      evidence: 'self_reported',
      note: 'Baseline self-assessment',
    });

    outcomes.push({
      competency: response.competency,
      selfLevel: clampLevel(response.selfLevel),
      resolvedLevel: record?.currentLevel ?? clampLevel(response.selfLevel),
      levelBefore,
      changed,
    });
  }

  return outcomes;
}

/** Current levels as a Map keyed by competency id - the shape computeGaps wants. */
export async function currentLevelMap(user) {
  const records = await UserCompetency.find({ user }).lean();
  return new Map(records.map((record) => [String(record.competency), record.currentLevel]));
}
