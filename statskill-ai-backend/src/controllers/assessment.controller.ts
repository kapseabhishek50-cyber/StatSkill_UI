import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { assessmentService } from '../services/assessment/assessment.service';

export const assessmentController = {
  start: asyncHandler(async (req: Request, res: Response) => {
    const result = await assessmentService.start(req.user!.id, req.body);
    sendSuccess(res, result, result.existing ? 'Assessment already in progress' : 'Assessment generated', result.existing ? 200 : 201);
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = await assessmentService.submit(req.params.id, req.user!.id, req.body);
    sendSuccess(res, result, 'Assessment submitted and scored');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const assessment = await assessmentService.getByIdForUser(req.params.id, req.user!.id);
    sendSuccess(res, { assessment: assessmentService.toLearnerView(assessment) }, 'Assessment');
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const history = await assessmentService.history(req.user!.id);
    sendSuccess(res, { history }, 'Assessment history');
  }),
};
