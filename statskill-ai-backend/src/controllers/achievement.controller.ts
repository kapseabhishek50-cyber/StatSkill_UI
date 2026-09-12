import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { achievementService } from '../services/achievement/achievement.service';

export const achievementController = {
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    const achievements = await achievementService.listAll();
    sendSuccess(res, { achievements }, 'Achievements');
  }),

  myAchievements: asyncHandler(async (req: Request, res: Response) => {
    const [result, progress] = await Promise.all([
      achievementService.listForUser(req.user!.id),
      achievementService.achievementProgress(req.user!.id),
    ]);
    sendSuccess(res, { ...result, progress }, 'Your achievements');
  }),
};
