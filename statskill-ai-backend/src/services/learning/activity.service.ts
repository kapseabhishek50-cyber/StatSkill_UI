import { LearningActivity, LearningActivityType, ILearningActivity } from '../../models/LearningActivity';
import { User } from '../../models/User';
import { recordActivityDay } from '../streak/streak.service';
import { XP_RULES, xpForQuiz, STREAK_MILESTONES, levelForXp } from '../../config/gamification';
import { achievementService } from '../achievement/achievement.service';
import { logger } from '../../utils/logger';

const log = logger;

export interface RecordActivityInput {
  userId: string;
  type: LearningActivityType;
  refType?: string;
  refId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  /** Extra XP context for quizzes. */
  quizScorePercent?: number;
}

export interface RecordActivityResult {
  activity: ILearningActivity;
  xpAwarded: number;
  streakMilestone: number | null;
  newAchievements: { code: string; title: string; xpReward: number }[];
  xpBonusFromStreak: number;
}

/**
 * The single entry point for "a meaningful learning activity happened"
 * (prompt §19-21). Updates: activity log → XP → streak → achievements →
 * notifications. Logins are NEVER passed here.
 */
export const recordLearningActivity = async (input: RecordActivityInput): Promise<RecordActivityResult> => {
  // 1. XP by activity type (config-driven).
  let xp = 0;
  switch (input.type) {
    case 'LESSON_COMPLETED':
    case 'MATERIAL_READ' as LearningActivityType:
      xp = XP_RULES.LESSON_COMPLETED;
      break;
    case 'QUIZ_COMPLETED':
      xp = xpForQuiz(input.quizScorePercent ?? 0);
      break;
    case 'COURSE_COMPLETED':
      xp = XP_RULES.COURSE_COMPLETED;
      break;
    case 'ASSESSMENT_COMPLETED':
      xp = XP_RULES.ASSESSMENT_COMPLETED;
      break;
    case 'DISCUSSION_PARTICIPATION':
      xp = XP_RULES.DISCUSSION_HELPFUL;
      break;
    case 'COURSE_STARTED':
    case 'PATH_STEP_COMPLETED':
      xp = 0;
      break;
    default:
      xp = 0;
  }

  // 2. Streak update (calendar-day logic).
  const { streak, milestoneReached } = await recordActivityDay(input.userId);
  let xpBonusFromStreak = 0;
  if (milestoneReached) {
    xpBonusFromStreak = XP_RULES.STREAK_MILESTONE_BONUS;
    xp += xpBonusFromStreak;
  }

  const activity = await LearningActivity.create({
    userId: input.userId,
    type: input.type,
    refType: input.refType,
    refId: input.refId,
    title: input.title,
    xpAwarded: xp,
    metadata: { ...(input.metadata ?? {}), streakAfter: streak.currentStreak },
  });

  // 3. XP + level on the user (atomic-ish).
  const user = await User.findByIdAndUpdate(
    input.userId,
    { $inc: { xp } },
    { new: true }
  );
  if (user) {
    user.level = levelForXp(user.xp);
    await user.save();
  }

  // 4. Achievements check (unlocks create notifications themselves).
  const unlocked = await achievementService.evaluateForUser(input.userId);

  log.info({ userId: input.userId, type: input.type, xp, milestone: milestoneReached }, 'learning activity recorded');
  return {
    activity,
    xpAwarded: xp,
    streakMilestone: milestoneReached ?? null,
    newAchievements: unlocked.map((a) => ({ code: a.achievement.code, title: a.achievement.title, xpReward: a.achievement.xpReward })),
    xpBonusFromStreak,
  };
};

export const listUserActivity = async (userId: string, limit = 20): Promise<ILearningActivity[]> =>
  LearningActivity.find({ userId }).sort({ createdAt: -1 }).limit(limit);
