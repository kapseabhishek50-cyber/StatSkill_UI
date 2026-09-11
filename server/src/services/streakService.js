import { User, StreakLog } from '../models/index.js';

export const XP_REWARDS = {
  LESSON_COMPLETED: 10,
  QUIZ_COMPLETED: 25,
  HIGH_SCORE_QUIZ: 40,
  SEVEN_DAY_STREAK: 100,
  DISCUSSION_CONTRIBUTION: 20,
};

export const BADGE_DEFINITIONS = {
  FIRST_ASSESSMENT: {
    badgeId: 'first_assessment',
    title: 'First Assessment',
    description: 'Completed your baseline statistical competency self-assessment.',
    icon: 'Award',
  },
  SEVEN_DAY_LEARNER: {
    badgeId: '7_day_learner',
    title: '7 Day Learner',
    description: 'Maintained a 7-day active learning streak across statistical modules.',
    icon: 'Flame',
  },
  QUIZ_MASTER: {
    badgeId: 'quiz_master',
    title: 'Quiz Master',
    description: 'Cleared multiple competency quizzes with 80%+ mastery.',
    icon: 'GraduationCap',
  },
  COURSE_EXPLORER: {
    badgeId: 'course_explorer',
    title: 'Course Explorer',
    description: 'Enrolled in iGOT and NSSTA statistical capacity building programs.',
    icon: 'Compass',
  },
  SKILL_IMPROVER: {
    badgeId: 'skill_improver',
    title: 'Skill Improver',
    description: 'Elevated verified competency levels through rigorous assessments.',
    icon: 'TrendingUp',
  },
  THIRTY_DAY_CHAMPION: {
    badgeId: '30_day_champion',
    title: '30 Day Champion',
    description: 'Completed 30 days of active capacity building.',
    icon: 'Trophy',
  },
};

/**
 * Records a verified learning action, updates daily streak, awards XP, and evaluates badges.
 * Login events are deliberately excluded.
 */
export async function recordActivity(userId, { activityType, detail, xp = 0, minutes = 0 }) {
  const user = await User.findById(userId);
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const existingToday = await StreakLog.findOne({ user: userId, dateString: today });

  // 1. Log activity
  await StreakLog.create({
    user: userId,
    dateString: today,
    activityType,
    detail,
    xpEarned: xp,
    minutesSpent: minutes,
  });

  // 2. Compute streaks
  let newStreak = user.currentStreak || 0;
  if (!existingToday) {
    if (user.lastActiveDate) {
      const lastDate = new Date(user.lastActiveDate);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }
  }

  const longestStreak = Math.max(user.longestStreak || 0, newStreak);
  let xpAwarded = (user.xp || 0) + xp;

  // Streak bonus
  if (newStreak === 7 && (user.currentStreak || 0) < 7) {
    xpAwarded += XP_REWARDS.SEVEN_DAY_STREAK;
  }

  // 3. Evaluate Badges
  const userBadges = user.badges || [];
  const existingBadgeIds = new Set(userBadges.map((b) => b.badgeId));

  function awardBadge(def) {
    if (!existingBadgeIds.has(def.badgeId)) {
      userBadges.push({
        badgeId: def.badgeId,
        title: def.title,
        description: def.description,
        icon: def.icon,
        awardedAt: new Date(),
      });
      existingBadgeIds.add(def.badgeId);
    }
  }

  if (activityType === 'first_assessment') awardBadge(BADGE_DEFINITIONS.FIRST_ASSESSMENT);
  if (newStreak >= 7) awardBadge(BADGE_DEFINITIONS.SEVEN_DAY_LEARNER);
  if (activityType === 'quiz_completed' && xp >= XP_REWARDS.HIGH_SCORE_QUIZ) awardBadge(BADGE_DEFINITIONS.QUIZ_MASTER);
  if (activityType === 'course_completed') awardBadge(BADGE_DEFINITIONS.SKILL_IMPROVER);

  const totalDays = await StreakLog.distinct('dateString', { user: userId });
  if (totalDays.length >= 30) awardBadge(BADGE_DEFINITIONS.THIRTY_DAY_CHAMPION);

  // 4. Persist User
  user.currentStreak = newStreak;
  user.longestStreak = longestStreak;
  user.lastActiveDate = new Date(today);
  user.xp = xpAwarded;
  user.learningHours = (user.learningHours || 0) + Math.round((minutes / 60) * 10) / 10;
  user.badges = userBadges;
  await user.save();

  return {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    xp: user.xp,
    badges: user.badges,
  };
}

/**
 * Returns the calendar activity heatmap for the last 90 or 365 days.
 */
export async function getActivityHeatmap(userId, days = 90) {
  const logs = await StreakLog.find({ user: userId }).sort({ dateString: 1 }).lean();

  const activityMap = new Map();
  for (const log of logs) {
    const existing = activityMap.get(log.dateString) || { date: log.dateString, count: 0, xp: 0, minutes: 0 };
    existing.count += 1;
    existing.xp += log.xpEarned || 0;
    existing.minutes += log.minutesSpent || 0;
    activityMap.set(log.dateString, existing);
  }

  return Array.from(activityMap.values());
}

