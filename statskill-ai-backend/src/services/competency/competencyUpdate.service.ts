import { UserCompetency, IUserCompetency } from '../../models/UserCompetency';
import { competencyUpdateConfig } from '../../config/competency';
import { logger } from '../../utils/logger';

const log = logger;

export interface CompetencyUpdateInput {
  userId: string;
  competencyId: string;
  observedScore: number; // percent scored on the quiz/assessment section
  requiredScore: number;
  confidence?: number;
  /** assessment can lower a score (fresh measurement); quiz can only raise it */
  canDecrease: boolean;
  source: 'ASSESSMENT' | 'QUIZ';
}

/**
 * Deterministic competency update (prompt §27, §54). An LLM is never allowed
 * to write competency scores — this module is the ONLY writer.
 *
 * - ASSESSMENT: blended measurement new = w*observed + (1-w)*current (can decrease).
 * - QUIZ:       improvement only — raises the score proportionally to quiz evidence.
 * - Course completion grants a small configurable boost.
 */
export const applyCompetencyUpdate = async (input: CompetencyUpdateInput): Promise<IUserCompetency> => {
  const existing = await UserCompetency.findOne({ userId: input.userId, competencyId: input.competencyId });
  const observed = Math.max(0, Math.min(100, Math.round(input.observedScore)));
  const required = Math.max(0, Math.min(100, Math.round(input.requiredScore)));

  let newScore: number;
  if (!existing) {
    newScore = observed;
  } else {
    const current = existing.currentScore;
    switch (input.source) {
      case 'ASSESSMENT':
        if (competencyUpdateConfig.mode === 'max') newScore = Math.max(current, observed);
        else if (competencyUpdateConfig.mode === 'replace') newScore = observed;
        else newScore = competencyUpdateConfig.assessmentObservedWeight * observed + (1 - competencyUpdateConfig.assessmentObservedWeight) * current;
        break;
      case 'QUIZ':
      default: {
        if (observed <= current) {
          newScore = current; // quizzes cannot lower competency
        } else {
          const lift = (observed - current) * competencyUpdateConfig.quizImproveWeight;
          newScore = current + lift;
        }
        break;
      }
    }
    if (!input.canDecrease) newScore = Math.max(newScore, current);
    newScore = Math.max(0, Math.min(100, Math.round(newScore)));
  }

  const doc = await UserCompetency.findOneAndUpdate(
    { userId: input.userId, competencyId: input.competencyId },
    {
      $set: {
        currentScore: newScore,
        requiredScore: required,
        confidence: input.confidence ?? 0.6,
        source: input.source,
        lastAssessedAt: new Date(),
        ...(existing && existing.initialScore === 0 && existing.currentScore === 0 ? { initialScore: newScore } : {}),
        ...(existing ? {} : { initialScore: 0 }),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  log.info(
    { userId: input.userId, competencyId: input.competencyId, from: existing?.currentScore, to: newScore, via: input.source },
    'competency updated'
  );
  return doc;
};

/** Small deterministic bump when a course is completed. */
export const applyCourseCompletionBoost = async (
  userId: string,
  competencyId: string,
  requiredScore: number
): Promise<void> => {
  const existing = await UserCompetency.findOne({ userId, competencyId });
  const current = existing?.currentScore ?? 0;
  const newScore = Math.min(100, current + competencyUpdateConfig.courseCompletionBoost);
  await UserCompetency.findOneAndUpdate(
    { userId, competencyId },
    {
      $set: {
        currentScore: newScore,
        requiredScore: requiredScore || existing?.requiredScore || 60,
        source: existing?.source ?? 'COURSE',
        lastAssessedAt: new Date(),
      },
      $setOnInsert: { initialScore: current },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/** Preserves the original baseline once, for the SKILL_IMPROVER achievement. */
export const ensureInitialScore = async (userId: string, competencyId: string, score: number): Promise<void> => {
  const existing = await UserCompetency.findOne({ userId, competencyId });
  if (existing && !existing.isModified('initialScore') && existing.initialScore === 0 && score > 0) {
    existing.initialScore = score;
    await existing.save();
  }
};
