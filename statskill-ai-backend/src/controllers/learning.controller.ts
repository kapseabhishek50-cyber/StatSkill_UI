import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { learningService } from '../services/learning/learning.service';
import { progressService } from '../services/learning/progress.service';
import { learningPathService } from '../services/learning/learningPath.service';
import { listUserActivity } from '../services/learning/activity.service';
import { mongoIdSchema } from '../validators/auth.validator';
import { badRequest } from '../utils/errors';

const requireCourseId = (id: string): string => {
  const parsed = mongoIdSchema.safeParse(id);
  if (!parsed.success) throw badRequest('Invalid course id');
  return parsed.data;
};

export const learningController = {
  enroll: asyncHandler(async (req: Request, res: Response) => {
    const courseId = requireCourseId(req.params.courseId);
    const { enrollment, alreadyEnrolled } = await learningService.enroll(req.user!.id, courseId);
    sendSuccess(res, { enrollment }, alreadyEnrolled ? 'Already enrolled' : 'Enrolled successfully', alreadyEnrolled ? 200 : 201);
  }),

  myCourses: asyncHandler(async (req: Request, res: Response) => {
    const result = await learningService.myCourses(req.user!.id, req, req.query.status as string | undefined);
    sendSuccess(res, result, 'My courses');
  }),

  getProgress: asyncHandler(async (req: Request, res: Response) => {
    const courseId = requireCourseId(req.params.courseId);
    const result = await learningService.getProgress(req.user!.id, courseId);
    sendSuccess(res, result, 'Course progress');
  }),

  updateProgress: asyncHandler(async (req: Request, res: Response) => {
    const courseId = requireCourseId(req.params.courseId);
    const result = await learningService.updateProgress(req.user!.id, courseId, req.body);
    sendSuccess(res, result, 'Progress updated');
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const courseId = requireCourseId(req.params.courseId);
    const result = await learningService.complete(req.user!.id, courseId);
    sendSuccess(res, result, result.alreadyCompleted ? 'Course already completed' : 'Course completed');
  }),

  timeline: asyncHandler(async (req: Request, res: Response) => {
    const courseId = requireCourseId(req.params.courseId);
    const result = await progressService.courseTimeline(req.user!.id, courseId);
    sendSuccess(res, result, 'Course activity timeline');
  }),

  summary: asyncHandler(async (req: Request, res: Response) => {
    const result = await progressService.summary(req.user!.id);
    sendSuccess(res, result, 'Learning summary');
  }),

  activity: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const items = await listUserActivity(req.user!.id, limit);
    sendSuccess(res, { activities: items }, 'Learning activity');
  }),

  // ---------- learning paths ----------

  generatePath: asyncHandler(async (req: Request, res: Response) => {
    const path = await learningPathService.generateForUser(req.user!.id, req.body ?? {});
    sendSuccess(res, { path }, 'Learning path generated', 201);
  }),

  getPath: asyncHandler(async (req: Request, res: Response) => {
    const path = await learningPathService.getActive(req.user!.id);
    sendSuccess(res, { path }, 'Active learning path');
  }),

  listPaths: asyncHandler(async (req: Request, res: Response) => {
    const paths = await learningPathService.list(req.user!.id);
    sendSuccess(res, { paths }, 'Learning paths');
  }),
};
