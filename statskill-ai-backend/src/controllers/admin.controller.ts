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
    if (req.query.q) filter.$or = [{ name: new RegExp(String(req.query.q), 'i') }, { email: new RegExp(String(req.query.q), 'i') }];
    if (req.query.isActive !== undefined) filter.isActive = String(req.query.isActive) === 'true';
    const [items, total] = await Promise.all([
      User.find(filter).select('-passwordHash -refreshTokens').sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      User.countDocuments(filter),
    ]);
    sendSuccess(res, { items, pagination: buildPagination(total, p) }, 'Users');
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
    const aggregated = await skillGapService.aggregatedTopGaps(Number(req.query.limit) || 15);
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
