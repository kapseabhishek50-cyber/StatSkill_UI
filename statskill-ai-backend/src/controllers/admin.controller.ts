import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { parsePagination, mongoSort, buildPagination } from '../utils/pagination';
import { analyticsService } from '../services/analytics/analytics.service';
import { skillGapService } from '../services/skillGap/skillGap.service';
import { competencyService } from '../services/competency/competency.service';
import { courseService } from '../services/course/course.service';
import { courseSyncService } from '../services/integrations/courseSync.service';
import { providerStatuses } from '../services/integrations';
import { AuditLog } from '../models/AuditLog';
import { adminInsightsService } from '../services/analytics/adminInsights.service';
import { notFound, badRequest } from '../utils/errors';

export const adminController = {
  dashboard: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await analyticsService.adminDashboard();
    sendSuccess(res, stats, 'Admin dashboard');
  }),

  users: asyncHandler(async (req: Request, res: Response) => {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.role) filter.role = String(req.query.role).toUpperCase();
    if (req.query.department) filter.department = req.query.department;
    const search = req.query.q ?? req.query.search;
    if (search) filter.$or = [{ name: new RegExp(String(search), 'i') }, { email: new RegExp(String(search), 'i') }];
    if (req.query.isActive !== undefined) filter.isActive = String(req.query.isActive) === 'true';
    const [items, total] = await Promise.all([
      User.find(filter).select('-passwordHash -refreshTokens').sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      User.countDocuments(filter),
    ]);
    // ?enrich=true adds per-officer readiness + open gap count for the directory.
    if (String(req.query.enrich ?? '') === 'true') {
      const ids = items.map((u) => String(u._id));
      const enriched = await adminInsightsService.enrichUsers(ids);
      const withStats = items.map((u) => {
        const stats = enriched.get(String(u._id)) ?? { readiness: 0, gapCount: 0 };
        return {
          ...u.toObject(),
          id: String(u._id),
          department: { name: u.department ?? 'Unassigned' },
          jobRole: { title: u.designation ?? '—' },
          readiness: stats.readiness,
          gapCount: stats.gapCount,
        };
      });
      return sendSuccess(res, { officers: withStats, items: withStats, pagination: buildPagination(total, p) }, 'Users');
    }
    sendSuccess(res, { items, pagination: buildPagination(total, p) }, 'Users');
  }),

  /** Officer 360° detail for the admin directory (read is audit-logged). */
  userDetail: asyncHandler(async (req: Request, res: Response) => {
    const detail = await adminInsightsService.userDetail(req.params.id);
    const { audit } = await import('../middleware/audit.middleware');
    void audit(req, 'OFFICER_VIEWED', 'user', req.params.id);
    sendSuccess(res, detail, 'Officer detail');
  }),

  /** Division × competency heatmap for workforce analytics. */
  heatmap: asyncHandler(async (req: Request, res: Response) => {
    const heat = await adminInsightsService.heatmap(
      Math.min(20, Number(req.query.departments) || 12),
      Math.min(24, Number(req.query.competencies) || 16)
    );
    sendSuccess(res, heat, 'Workforce heatmap');
  }),

  updateUserRole: asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.body as { role: 'LEARNER' | 'TRAINER' | 'ADMIN' };
    if (!['LEARNER', 'TRAINER', 'ADMIN'].includes(role)) throw badRequest('Invalid role');
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-passwordHash -refreshTokens');
    if (!user) throw notFound('User not found');
    const { audit } = await import('../middleware/audit.middleware');
    void audit(req, 'ROLE_CHANGED', 'user', String(user._id), { newRole: role });
    sendSuccess(res, { user }, 'Role updated');
  }),

  toggleUserActive: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found');
    user.isActive = !user.isActive;
    await user.save();
    sendSuccess(res, { user: { id: user._id, isActive: user.isActive } }, user.isActive ? 'User activated' : 'User deactivated');
  }),

  competencies: asyncHandler(async (_req: Request, res: Response) => {
    const [competencies, roles] = await Promise.all([competencyService.listTaxonomy(), competencyService.listRoles()]);
    sendSuccess(res, { competencies, roles }, 'Competency framework');
  }),

  skillGaps: asyncHandler(async (req: Request, res: Response) => {
    const aggregated = await skillGapService.aggregatedTopGaps(
      Number(req.query.limit) || 15,
      typeof req.query.department === 'string' && req.query.department ? req.query.department : undefined
    );
    sendSuccess(res, { topGaps: aggregated }, 'Workforce skill gaps');
  }),

  courses: asyncHandler(async (req: Request, res: Response) => {
    const result = await courseService.list(req);
    sendSuccess(res, result, 'Courses');
  }),

  createCourse: asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.create(req.body, req.user!.id);
    sendSuccess(res, { course }, 'Course created', 201);
  }),

  updateCourse: asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.update(req.params.id, req.body, req.user!.id);
    sendSuccess(res, { course }, 'Course updated');
  }),

  /** Soft-deactivates a course (reversible via update with isActive:true). */
  deleteCourse: asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.deactivate(req.params.id);
    const { audit } = await import('../middleware/audit.middleware');
    void audit(req, 'COURSE_DEACTIVATED', 'course', req.params.id);
    sendSuccess(res, { course }, 'Course deactivated');
  }),

  /** All quizzes in any status, for the admin/trainer question bank. */
  quizzes: asyncHandler(async (req: Request, res: Response) => {
    const { quizService } = await import('../services/quiz/quiz.service');
    const result = await quizService.listForAdmin(req);
    sendSuccess(res, result, 'Quizzes');
  }),

  /** Full quiz review (any owner) for admins. */
  quizReview: asyncHandler(async (req: Request, res: Response) => {
    const { quizService } = await import('../services/quiz/quiz.service');
    const result = await quizService.reviewAny(req.params.id);
    sendSuccess(res, result, 'Quiz review');
  }),

  syncCourses: asyncHandler(async (req: Request, res: Response) => {
    const result = await courseSyncService.syncAll('manual');
    sendSuccess(res, result, 'Course sync finished');
  }),

  providerStatus: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { providers: providerStatuses() }, 'Provider status');
  }),

  auditLogs: asyncHandler(async (req: Request, res: Response) => {
    const p = parsePagination(req.query, 50);
    const filter: Record<string, unknown> = {};
    if (req.query.action) filter.action = String(req.query.action).toUpperCase();
    if (req.query.userId) filter.userId = req.query.userId;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      AuditLog.countDocuments(filter),
    ]);
    sendSuccess(res, { items, pagination: buildPagination(total, p) }, 'Audit logs');
  }),

  analytics: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await analyticsService.adminDashboard();
    sendSuccess(res, stats, 'Platform analytics');
  }),
};
