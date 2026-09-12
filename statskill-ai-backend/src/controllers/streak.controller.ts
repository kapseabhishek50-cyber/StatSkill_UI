import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { getStreak } from '../services/streak/streak.service';
import { STREAK_MILESTONES } from '../config/gamification';

export const streakController = {
  /** GET /api/streak — read-only view (updates happen via real activities only). */
  get: asyncHandler(async (req: Request, res: Response) => {
    const streak = await getStreak(req.user!.id);
    sendSuccess(res, { streak, milestones: STREAK_MILESTONES }, 'Streak');
  }),
};
