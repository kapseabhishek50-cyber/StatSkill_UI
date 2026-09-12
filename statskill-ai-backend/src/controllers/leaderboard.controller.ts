import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { Streak } from '../models/Streak';
import { Enrollment } from '../models/Enrollment';

/**
 * GET /api/leaderboard — workforce capacity standings ordered by XP.
 * Name + division + role are directory-level data (same visibility as the
 * officer directory); no competency scores are exposed here.
 */
export const leaderboardController = {
  standings: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(100, Math.max(3, Number(req.query.limit) || 50));
    const users = await User.find({ role: 'LEARNER', isActive: true })
      .select('name employeeId department designation xp level')
      .sort({ xp: -1, name: 1 })
      .limit(limit);
    const ids = users.map((u) => u._id);
    const [streaks, enrollments] = await Promise.all([
      Streak.find({ userId: { $in: ids } }),
      Enrollment.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: '$userId', minutes: { $sum: '$timeSpentMinutes' } } },
      ]),
    ]);
    const streakByUser = new Map(streaks.map((s) => [String(s.userId), s.currentStreak]));
    const minutesByUser = new Map(
      (enrollments as { _id: unknown; minutes: number }[]).map((e) => [String(e._id), e.minutes])
    );
    const leaderboard = users.map((u, index) => ({
      id: String(u._id),
      rank: index + 1,
      name: u.name,
      employeeId: u.employeeId ?? '—',
      department: u.department ?? 'Unassigned',
      jobRole: u.designation ?? 'Officer',
      currentStreak: streakByUser.get(String(u._id)) ?? 0,
      learningHours: Math.round(((minutesByUser.get(String(u._id)) ?? 0) / 60) * 10) / 10,
      xp: u.xp ?? 0,
      level: u.level ?? 1,
      isCurrentUser: req.user ? String(u._id) === req.user.id : false,
    }));
    sendSuccess(res, { leaderboard }, 'Leaderboard standings');
  }),
};
