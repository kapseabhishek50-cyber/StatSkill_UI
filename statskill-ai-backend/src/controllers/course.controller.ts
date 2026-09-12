import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { courseService } from '../services/course/course.service';
import { courseSearchService } from '../services/course/courseSearch.service';

export const courseController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await courseService.list(req);
    sendSuccess(res, result, 'Courses');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.getById(req.params.id);
    sendSuccess(res, { course }, 'Course');
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return sendSuccess(res, { items: [], pagination: buildEmptyPagination(req), query: q }, 'Empty query');
    const semantic = String(req.query.semantic ?? 'false') === 'true';
    const result = await courseSearchService.search(q, req, { semantic });
    sendSuccess(res, result, 'Search results');
  }),

  byCategory: asyncHandler(async (req: Request, res: Response) => {
    const result = await courseService.listByCategory(req.params.category, req);
    sendSuccess(res, result, 'Courses by category');
  }),

  bySkill: asyncHandler(async (req: Request, res: Response) => {
    const result = await courseService.listBySkill(req.params.skill, req);
    sendSuccess(res, result, 'Courses by skill');
  }),

  categories: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await courseService.categories();
    sendSuccess(res, { categories }, 'Course categories');
  }),
};

const buildEmptyPagination = (req: Request) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return { page, limit, total: 0, totalPages: 1 };
};
