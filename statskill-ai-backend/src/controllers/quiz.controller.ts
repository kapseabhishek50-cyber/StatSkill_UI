import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { quizService } from '../services/quiz/quiz.service';
import { requireRole } from '../middleware/role.middleware';
import { unauthorized } from '../utils/errors';

export const quizController = {
  /** Learner: published quizzes + take + submit. */
  listPublished: asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.listForLearner(req);
    sendSuccess(res, result, 'Published quizzes');
  }),

  getForLearner: asyncHandler(async (req: Request, res: Response) => {
    const quiz = await quizService.getForLearner(req.params.id);
    sendSuccess(res, { quiz }, 'Quiz');
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.submit(req.params.id, req.user!.id, req.body);
    sendSuccess(res, result, 'Quiz submitted');
  }),

  myAttempts: asyncHandler(async (req: Request, res: Response) => {
    const { QuizAttempt } = await import('../models/QuizAttempt');
    const attempts = await QuizAttempt.find({ userId: req.user!.id })
      .sort({ submittedAt: -1 })
      .limit(50)
      .populate('quizId', 'title status');
    sendSuccess(res, { attempts }, 'My quiz attempts');
  }),

  // ---------- trainer (also used by trainer.routes) ----------
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw unauthorized();
    const quiz = await quizService.createManual({ ...req.body, createdBy: req.user.id });
    sendSuccess(res, { quiz }, 'Quiz created as draft', 201);
  }),

  generate: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw unauthorized();
    const result = await quizGeneratorWrapper(req.user.id, req.body);
    sendSuccess(res, result, 'Quiz generated (draft — review before publishing)', 201);
  }),
};

const quizGeneratorWrapper = async (userId: string, body: { materialId?: string; topic?: string; competencyCode?: string; count?: number }) => {
  const { quizGeneratorService } = await import('../services/quiz/quizGenerator.service');
  return quizGeneratorService.generate({ ...body, createdBy: userId });
};

export { requireRole };
