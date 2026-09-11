import { Router } from 'express';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { BADGE_DEFINITIONS, getActivityHeatmap } from '../services/streakService.js';

const router = Router();
router.use(requireAuth);

/**
 * Get current user's streak status, XP, and calendar heatmap.
 */
router.get(
  '/streak',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('xp currentStreak longestStreak learningHours badges lastActiveDate');
    const heatmap = await getActivityHeatmap(req.user._id);

    res.json({
      currentStreak: user?.currentStreak || 0,
      longestStreak: user?.longestStreak || 0,
      xp: user?.xp || 0,
      learningHours: user?.learningHours || 0,
      lastActiveDate: user?.lastActiveDate,
      heatmap,
    });
  }),
);

/**
 * Organization Leaderboard (filterable by cadre/department).
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const filter = { role: 'learner', isActive: true };
    if (req.query.department) {
      filter.department = req.query.department;
    }

    const leaders = await User.find(filter)
      .select('name employeeId xp currentStreak learningHours department jobRole')
      .populate('department', 'name')
      .populate('jobRole', 'title')
      .sort({ xp: -1, learningHours: -1 })
      .limit(50)
      .lean();

    const ranked = leaders.map((leader, index) => ({
      rank: index + 1,
      id: leader._id,
      name: leader.name,
      employeeId: leader.employeeId,
      department: leader.department?.name || 'MoSPI',
      jobRole: leader.jobRole?.title || 'Statistical Officer',
      xp: leader.xp || 0,
      currentStreak: leader.currentStreak || 0,
      learningHours: leader.learningHours || 0,
      isCurrentUser: String(leader._id) === String(req.user._id),
    }));

    res.json({ leaderboard: ranked });
  }),
);

/**
 * User Badges and Available Milestone Badges.
 */
router.get(
  '/badges',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('badges');
    const unlockedMap = new Map((user?.badges || []).map((b) => [b.badgeId, b.awardedAt]));

    const allBadges = Object.values(BADGE_DEFINITIONS).map((badge) => ({
      ...badge,
      unlocked: unlockedMap.has(badge.badgeId),
      awardedAt: unlockedMap.get(badge.badgeId) || null,
    }));

    res.json({ badges: allBadges });
  }),
);

export default router;

