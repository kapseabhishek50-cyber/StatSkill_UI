import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { quizService } from '../services/quiz/quiz.service';
import { materialService } from '../services/material/material.service';
import { analyticsService } from '../services/analytics/analytics.service';

export const trainerController = {
  materials: asyncHandler(async (req: Request, res: Response) => {
    const result = await materialService.listForTrainer(req.user!.id, req);
    sendSuccess(res, result, 'Materials');
  }),

  quizzes: asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.listForTrainer(req.user!.id, req);
    sendSuccess(res, result, 'Your quizzes');
  }),

  quizReview: asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.review(req.params.id, req.user!.id);
    sendSuccess(res, result, 'Quiz review');
  }),

  updateQuiz: asyncHandler(async (req: Request, res: Response) => {
    const quiz = await quizService.updateDraft(req.params.id, req.user!.id, req.body);
    sendSuccess(res, { quiz }, 'Quiz updated');
  }),

  publishQuiz: asyncHandler(async (req: Request, res: Response) => {
    const quiz = await quizService.publish(req.params.id, req.user!.id);
    sendSuccess(res, { quiz }, 'Quiz published');
  }),

  archiveQuiz: asyncHandler(async (req: Request, res: Response) => {
    const quiz = await quizService.archive(req.params.id, req.user!.id);
    sendSuccess(res, { quiz }, 'Quiz archived');
  }),

  learners: asyncHandler(async (req: Request, res: Response) => {
    const learners = await quizService.learnersForTrainer(req.user!.id);
    sendSuccess(res, { learners }, 'Learners');
  }),

  quizResults: asyncHandler(async (req: Request, res: Response) => {
    const result = await quizService.resultsForQuiz(req.params.id, req.user!.id);
    sendSuccess(res, result, 'Quiz results');
  }),

  analytics: asyncHandler(async (req: Request, res: Response) => {
    const result = await analyticsService.trainerAnalytics(req.user!.id);
    sendSuccess(res, result, 'Trainer analytics');
  }),
};
