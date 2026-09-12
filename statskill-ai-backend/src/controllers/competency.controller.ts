import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { competencyService } from '../services/competency/competency.service';
import { UserCompetency } from '../models/UserCompetency';
import { GAP_THRESHOLDS } from '../config/competency';

export const competencyController = {
  /** GET /api/competencies — full taxonomy with categories. */
  listTaxonomy: asyncHandler(async (req: Request, res: Response) => {
    const [items, roles] = await Promise.all([
      competencyService.listTaxonomy(req.query.category as string | undefined),
      competencyService.listRoles(),
    ]);
    sendSuccess(res, { competencies: items, roles: roles.map((r) => ({ id: r._id, name: r.name, code: r.code, requirementCount: r.requirements.length })), thresholds: GAP_THRESHOLDS }, 'Competency taxonomy');
  }),

  /** GET /api/competencies/me — measured competencies + gaps for the current user. */
  myCompetencies: asyncHandler(async (req: Request, res: Response) => {
    const docs = await UserCompetency.find({ userId: req.user!.id })
      .populate('competencyId', 'name code category description')
      .sort({ gap: -1 });
    sendSuccess(res, { competencies: docs }, 'Your competencies');
  }),

  listRoles: asyncHandler(async (_req: Request, res: Response) => {
    const roles = await competencyService.listRoles();
    sendSuccess(res, { roles }, 'Roles');
  }),
};
