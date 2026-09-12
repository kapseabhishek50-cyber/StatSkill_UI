import { Streak, IStreak } from '../../models/Streak';
import { startOfDay, dayDiff } from '../../utils/date';
import { STREAK_MILESTONES, XP_RULES } from '../../config/gamification';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../utils/logger';

const log = logger;

export interface StreakUpdateResult {
  streak: IStreak;
  milestoneReached: number | null; // day-count milestone crossed now (for XP/notification)
}

/**
 * Streak engine (prompt §20). Meaningful activity only — logins never count.
 *   today == lastActivity            → no change
 *   today == lastActivity + 1 day    → currentStreak++
 *   otherwise                        → currentStreak = 1
 */
export const recordActivityDay = async (userId: string): Promise<StreakUpdateResult> => {
  const today = startOfDay(new Date());
  let streak = await Streak.findOne({ userId });
  if (!streak) streak = await Streak.create({ userId });

  if (streak.lastActivityDate) {
    const diff = dayDiff(streak.lastActivityDate, today);
    if (diff === 0) {
      // already counted today
    } else if (diff === 1) {
      streak.currentStreak += 1;
      streak.totalLearningDays += 1;
      streak.lastActivityDate = today;
    } else {
      streak.currentStreak = 1;
      streak.totalLearningDays += 1;
      streak.lastActivityDate = today;
    }
  } else {
    streak.currentStreak = 1;
    streak.totalLearningDays = 1;
    streak.lastActivityDate = today;
  }

  if (streak.currentStreak > streak.longestStreak) streak.longestStreak = streak.currentStreak;

  let milestoneReached: number | null = null;
  const crossed = STREAK_MILESTONES.find((m) => streak!.currentStreak >= m && streak!.lastMilestone < m);
  if (crossed) {
    streak.lastMilestone = crossed;
    milestoneReached = crossed;
  }

  await streak.save();

  if (milestoneReached) {
    void notificationService.push({
      userId,
      type: 'STREAK_MILESTONE',
      title: `${milestoneReached}-day learning streak!`,
      body: `You've learned on ${milestoneReached} consecutive days. Bonus +${XP_RULES.STREAK_MILESTONE_BONUS} XP.`,
      data: { milestone: milestoneReached, streak: streak.currentStreak },
    });
    log.info({ userId, milestone: milestoneReached }, 'streak milestone');
  }

  return { streak, milestoneReached };
};

export const getStreak = async (userId: string): Promise<IStreak> => {
  const streak = await Streak.findOne({ userId });
  if (streak) {
    // A streak that has gone cold displays as 0 until the next activity.
    if (streak.lastActivityDate && dayDiff(streak.lastActivityDate, new Date()) > 1) {
      streak.currentStreak = 0;
    }
    return streak;
  }
  return Streak.create({ userId });
};
