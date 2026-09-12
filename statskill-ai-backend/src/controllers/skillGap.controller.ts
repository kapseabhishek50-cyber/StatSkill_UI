import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { skillGapService } from '../services/skillGap/skillGap.service';

export const skillGapController = {
  /** GET /api/skill-gaps/me — current gap snapshot (recomputes deterministically). */
  myGaps: asyncHandler(async (req: Request, res: Response) => {
    const gaps = await skillGapService.recalculateForUser(req.user!.id);
    const sorted = [...gaps].sort((a, b) => b.gap - a.gap);
    const open = sorted.filter((g) => g.status !== 'CLOSED');
    sendSuccess(res, { skillGaps: sorted, openCount: open.length, closedCount: sorted.length - open.length }, 'Skill gaps');
  }),
};
