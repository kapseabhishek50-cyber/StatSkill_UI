import { Achievement, IAchievement } from '../../models/Achievement';
import { UserAchievement, IUserAchievement } from '../../models/UserAchievement';
import { AssessmentAttempt } from '../../models/AssessmentAttempt';
import { QuizAttempt } from '../../models/QuizAttempt';
import { Enrollment } from '../../models/Enrollment';
import { Streak } from '../../models/Streak';
import { UserCompetency } from '../../models/UserCompetency';
import { Message } from '../../models/Message';
import { notificationService } from '../notification/notification.service';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';

const log = logger;

export interface UnlockedAchievement {
  achievement: IAchievement;
  record: IUserAchievement;
}

/**
 * Achievement engine (prompt §22):
 *   Activity → rules → conditions → unlock → notification.
 * Rule thresholds come from the Achievement collection (seeded, admin-editable).
 */
export const achievementService = {
  async evaluateForUser(userId: string): Promise<UnlockedAchievement[]> {
    const achievements = await Achievement.find({ isActive: true });
    if (!achievements.length) return [];

    const unlockedDocs = await UserAchievement.find({ userId });
    const unlockedIds = new Set(unlockedDocs.map((u) => String(u.achievementId)));
    const unlocked: UnlockedAchievement[] = [];

    for (const achievement of achievements) {
      if (unlockedIds.has(String(achievement._id))) continue;
      const check = await this.checkRule(userId, achievement);
      if (check) {
        const record = await UserAchievement.create({
          userId,
          achievementId: achievement._id,
          progress: 100,
        });
        unlocked.push({ achievement, record });
        // XP reward (without re-triggering activities).
        await User.findByIdAndUpdate(userId, { $inc: { xp: achievement.xpReward } });
        void notificationService.push({
          userId,
          type: 'ACHIEVEMENT_UNLOCKED',
          title: `Achievement unlocked: ${achievement.title}`,
          body: `${achievement.description} (+${achievement.xpReward} XP)`,
          data: { achievementCode: achievement.code, icon: achievement.icon },
        });
        log.info({ userId, code: achievement.code }, 'achievement unlocked');
      }
    }
    return unlocked;
  },

  async checkRule(userId: string, achievement: IAchievement): Promise<boolean> {
    const { type, threshold } = achievement.rule;
    try {
      switch (type) {
        case 'ASSESSMENTS_COMPLETED':
          return (await AssessmentAttempt.countDocuments({ userId })) >= threshold;
        case 'COURSES_COMPLETED':
          return (await Enrollment.countDocuments({ userId, status: 'COMPLETED' })) >= threshold;
        case 'ENROLLMENTS':
          return (await Enrollment.countDocuments({ userId })) >= threshold;
        case 'STREAK_DAYS': {
          const streak = await Streak.findOne({ userId });
          return (streak?.longestStreak ?? 0) >= threshold;
        }
        case 'QUIZZES_COMPLETED':
          return (await QuizAttempt.countDocuments({ userId })) >= threshold;
        case 'QUIZ_AVG_SCORE': {
          const result = await QuizAttempt.aggregate([
            { $match: { userId } },
            { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
          ]);
          const stats = result[0];
          return Boolean(stats && stats.count >= threshold && stats.avg >= 80);
        }
        case 'SKILL_IMPROVED': {
          const docs = await UserCompetency.find({ userId });
          return docs.some((d) => d.currentScore - (d.initialScore || 0) >= threshold);
        }
        case 'DISCUSSION_MESSAGES':
          return (await Message.countDocuments({ userId, isDeleted: false })) >= threshold;
        default:
          return false;
      }
    } catch (err) {
      log.warn({ err: (err as Error).message, code: achievement.code }, 'achievement rule check failed');
      return false;
    }
  },

  async listAll(): Promise<IAchievement[]> {
    return Achievement.find({ isActive: true }).sort({ category: 1, threshold: 1 });
  },

  async listForUser(userId: string) {
    const [all, unlocked] = await Promise.all([
      this.listAll(),
      UserAchievement.find({ userId }).populate('achievementId'),
    ]);
    const unlockedIds = new Set(unlocked.map((u) => String(u.achievementId)));
    return {
      unlocked: unlocked.map((u) => u.achievementId),
      locked: all.filter((a) => !unlockedIds.has(String(a._id))),
    };
  },

  async achievementProgress(userId: string) {
    const [assessments, coursesCompleted, enrollments, quizzes, streakDoc, competencyDocs, messages] =
      await Promise.all([
        AssessmentAttempt.countDocuments({ userId }),
        Enrollment.countDocuments({ userId, status: 'COMPLETED' }),
        Enrollment.countDocuments({ userId }),
        QuizAttempt.countDocuments({ userId }),
        Streak.findOne({ userId }),
        UserCompetency.find({ userId }),
        Message.countDocuments({ userId, isDeleted: false }),
      ]);
    const skillImprovement = competencyDocs.reduce(
      (max, d) => Math.max(max, d.currentScore - (d.initialScore || 0)),
      0
    );
    return {
      ASSESSMENTS_COMPLETED: assessments,
      COURSES_COMPLETED: coursesCompleted,
      ENROLLMENTS: enrollments,
      QUIZZES_COMPLETED: quizzes,
      STREAK_DAYS: streakDoc?.longestStreak ?? 0,
      SKILL_IMPROVED: skillImprovement,
      DISCUSSION_MESSAGES: messages,
    };
  },
};
