import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { recommendationService } from '../services/recommendation/recommendation.service';
import { competencyService } from '../services/competency/competency.service';
import { recommendationJob } from '../jobs/recommendation.job';
import { parsePagination, buildPagination } from '../utils/pagination';
import { notFound } from '../utils/errors';

export const recommendationController = {
  /** GET /api/recommendations — stored hybrid-engine output (fast, no AI call). */
  list: asyncHandler(async (req: Request, res: Response) => {
    const p = parsePagination(req.query, 10);
    const { items, total } = await recommendationService.listForUser(req.user!.id, {
      page: p.page,
      limit: p.limit,
      status: req.query.status as string | undefined,
    });
    sendSuccess(res, { recommendations: items, pagination: buildPagination(total, p) }, 'Recommendations');
  }),

  /** GET /api/recommendations/top — top N with lazy background refresh. */
  top: asyncHandler(async (req: Request, res: Response) => {
    const n = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const top = await recommendationService.topForUser(req.user!.id, n);
    sendSuccess(res, { recommendations: top }, 'Top recommendations');
  }),

  /** GET /api/recommendations/for-skill/:skillId — recommendations for one competency. */
  forSkill: asyncHandler(async (req: Request, res: Response) => {
    const competency = await competencyService.getByCode(req.params.skillId) ?? await competencyService.getById(req.params.skillId);
    if (!competency) throw notFound('Skill/competency not found');
    const items = await recommendationService.forSkill(req.user!.id, String(competency._id));
    if (!items.length) {
      // Generate on demand for this skill.
      const generated = await recommendationService.refreshForUser(req.user!.id, { competencyCode: competency.code, topN: 5 });
      return sendSuccess(res, { recommendations: generated, skill: { id: competency._id, code: competency.code, name: competency.name } }, 'Recommendations for skill');
    }
    sendSuccess(res, { recommendations: items, skill: { id: competency._id, code: competency.code, name: competency.name } }, 'Recommendations for skill');
  }),

  /** POST /api/recommendations/refresh — re-runs the hybrid pipeline (async job). */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const sync = req.query.sync === 'true' || req.query.sync === '1';
    if (sync) {
      // Demo/test path: run inline so results are immediately visible.
      const docs = await recommendationService.refreshForUser(req.user!.id, req.body ?? {});
      return sendSuccess(res, { recommendations: docs, mode: 'sync' }, 'Recommendations refreshed');
    }
    recommendationJob.enqueue(req.user!.id, req.body ?? {});
    sendSuccess(res, { queued: true, mode: 'async' }, 'Recommendation refresh queued', 202);
  }),

  dismiss: asyncHandler(async (req: Request, res: Response) => {
    const doc = await recommendationService.dismiss(req.user!.id, req.params.id);
    if (!doc) throw notFound('Recommendation not found');
    sendSuccess(res, { recommendation: doc }, 'Recommendation dismissed');
  }),
};
