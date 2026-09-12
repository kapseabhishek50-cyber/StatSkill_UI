import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { courseSearchService } from '../services/course/courseSearch.service';
import { Competency } from '../models/Competency';
import { Community } from '../models/Community';
import { Quiz } from '../models/Quiz';
import { LearningPath } from '../models/LearningPath';
import { multiFieldSearch } from '../utils/search';

/** GET /api/search?q= — grouped search across courses, skills, communities, paths, quizzes (prompt §35). */
export const searchController = {
  globalSearch: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(10, Number(req.query.limit) || 5);
    const semantic = String(req.query.semantic ?? 'false') === 'true';
    if (!q) {
      return sendSuccess(res, { query: '', courses: [], skills: [], communities: [], learningPaths: [], quizzes: [] }, 'Empty query');
    }

    const [courses, skills, communities, learningPaths, quizzes] = await Promise.all([
      courseSearchService.search(q, req, { semantic }).then((r) => r.items.slice(0, limit)),
      multiFieldSearch(Competency, ['name', 'code', 'keywords'], q, { limit }),
      multiFieldSearch(Community, ['name', 'description', 'category'], q, { limit, baseFilter: { isActive: true } }),
      req.user
        ? multiFieldSearch(LearningPath, ['title', 'description'], q, { limit, baseFilter: { userId: req.user.id } })
        : Promise.resolve([] as unknown as never[]),
      multiFieldSearch(
        Quiz,
        ['title', 'description'],
        q,
        { limit, baseFilter: { status: 'PUBLISHED' }, select: { title: 1, status: 1, durationMinutes: 1, createdAt: 1 } }
      ),
    ]);

    sendSuccess(res, { query: q, courses, skills, communities, learningPaths, quizzes }, 'Search results');
  }),
};
