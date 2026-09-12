import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { Streak } from '../models/Streak';
import { Achievement } from '../models/Achievement';
import { UserAchievement } from '../models/UserAchievement';
import { LearningActivity } from '../models/LearningActivity';
import { Notification } from '../models/Notification';
import { Enrollment } from '../models/Enrollment';
import { UserCompetency } from '../models/UserCompetency';
import { Competency } from '../models/Competency';
import { SkillGap } from '../models/SkillGap';
import { recommendationService } from '../services/recommendation/recommendation.service';
import { getStreak } from '../services/streak/streak.service';
import { unauthorized } from '../utils/errors';

/**
 * GET /api/dashboard — ONE optimized endpoint for the initial dashboard
 * (prompt §34): no 15 separate calls.
 */
export const userController = {
  dashboard: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw unauthorized();

    const [user, competencies, gaps, recommendations, continueLearningRaw, streak, achievements, recentActivity, notifications, xpTotal] =
      await Promise.all([
        User.findById(userId).select('-passwordHash -refreshTokens'),
        UserCompetency.find({ userId }).populate('competencyId', 'name code category'),
        SkillGap.find({ userId }).sort({ gap: -1, competencyCode: 1 }).limit(5),
        recommendationService.topForUser(userId, 5),
        Enrollment.find({ userId, status: 'ACTIVE' }).sort({ lastAccessedAt: -1 }).limit(3).populate('courseId', 'title provider level thumbnail totalDuration'),
        getStreak(userId),
        UserAchievement.find({ userId }).sort({ unlockedAt: -1 }).limit(5).populate('achievementId', 'title icon description'),
        LearningActivity.find({ userId }).sort({ createdAt: -1 }).limit(8),
        Notification.find({ userId, isRead: false }).sort({ createdAt: -1 }).limit(5),
        User.findById(userId).select('xp'),
      ]);

    // Competency summary for quick UI meter rendering (weakest first).
    const competencySummary = competencies
      .filter((c) => c.competencyId)
      .map((c) => {
        const comp = c.competencyId as unknown as { name: string; code: string; category: string };
        const rawId = (c.competencyId as unknown as { _id?: unknown })._id ?? c.competencyId;
        return {
          competencyId: String(rawId),
          name: comp?.name,
          code: comp?.code,
          category: comp?.category,
          currentScore: c.currentScore,
          requiredScore: c.requiredScore,
          gap: c.gap,
          priority: c.priority,
        };
      })
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8);

    // Skill gaps come straight from the deterministic engine snapshot (sorted by gap desc).
    const skillGaps = gaps.map((g) => ({
      competencyId: g.competencyId,
      code: g.competencyCode,
      name: g.competencyName,
      category: g.category,
      currentScore: g.currentScore,
      requiredScore: g.requiredScore,
      gap: g.gap,
      priority: g.priority,
      status: g.status,
    }));

    sendSuccess(
      res,
      {
        user: user && {
          id: String((user as { _id: unknown })._id),
          name: user.name,
          email: user.email,
          role: user.role,
          designation: user.designation,
          department: user.department,
          xp: xpTotal?.xp ?? user.xp,
          level: user.level,
          avatar: user.avatar,
        },
        competency: competencySummary,
        skillGaps,
        recommendations,
        continueLearning: continueLearningRaw,
        streak: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          totalLearningDays: streak.totalLearningDays,
          lastActivityDate: streak.lastActivityDate,
        },
        achievements,
        recentActivity,
        notifications,
      },
      'Dashboard'
    );
  }),
};
