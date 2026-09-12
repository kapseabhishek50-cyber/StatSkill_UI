import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { authService } from '../services/auth/auth.service';
import { rotateRefreshToken, revokeRefreshToken } from '../services/auth/token.service';
import { hashPassword } from '../services/auth/password.service';
import { audit } from '../middleware/audit.middleware';
import { unauthorized } from '../utils/errors';

const publicUser = (user: { _id: unknown; name: string; email: string; role: string; designation?: string; department?: string; organization?: string; experience?: number; xp?: number; level?: number; avatar?: string; employeeId?: string; interests?: string[]; learningGoals?: string[] }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  designation: user.designation,
  department: user.department,
  organization: user.organization,
  experience: user.experience,
  xp: user.xp,
  level: user.level,
  avatar: user.avatar,
  employeeId: user.employeeId,
  interests: user.interests,
  learningGoals: user.learningGoals,
});

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.register(req.body, req.body.role);
    void audit(req, 'REGISTER', 'user', String(user._id));
    sendSuccess(res, { user: publicUser(user), ...tokens }, 'Registration successful', 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.login(req.body.email, req.body.password);
    void audit(req, 'LOGIN', 'user', String(user._id));
    sendSuccess(res, { user: publicUser(user), ...tokens }, 'Login successful');
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    const header = req.headers.authorization;
    // Accept token from body or Authorization header.
    const token = refreshToken || (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw unauthorized('refreshToken is required');
    // Decode without verification first to find the user, then verify+rotate.
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.decode(token) as { uid?: string } | null;
    if (!decoded?.uid) throw unauthorized('Malformed refresh token');
    const { tokens, user } = await rotateRefreshToken(decoded.uid, token);
    void audit(req, 'REFRESH', 'user', String(user._id));
    sendSuccess(res, { ...tokens, user: publicUser(user) }, 'Token refreshed');
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.body as { refreshToken?: string })?.refreshToken;
    if (token && req.user) await revokeRefreshToken(req.user.id, token);
    void audit(req, 'LOGOUT', 'user', req.user?.id);
    sendSuccess(res, { loggedOut: true }, 'Logged out');
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = await authService.getById(req.user!.id);
    if (!user) throw unauthorized();
    const ok = await user.comparePassword(currentPassword);
    if (!ok) throw unauthorized('Current password is incorrect');
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    sendSuccess(res, { changed: true }, 'Password changed');
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getById(req.user!.id);
    if (!user) throw unauthorized();
    sendSuccess(res, { user: publicUser(user) }, 'Current user');
  }),

  /** Public: departments + job roles for the registration form (no auth). */
  registerOptions: asyncHandler(async (_req: Request, res: Response) => {
    const { Role } = await import('../models/Role');
    const roles = await Role.find({ isActive: true }).sort({ name: 1 });
    const departments = [...new Set(roles.map((r) => r.department).filter(Boolean))].sort();
    // Fallback list keeps registration usable even with an empty Role collection.
    const fallbackDepartments = [
      'National Statistical Office',
      'MoSPI',
      'NSSTA',
      'State Directorate of Economics & Statistics',
      'Survey Division',
    ];
    sendSuccess(
      res,
      {
        departments: departments.length ? departments : fallbackDepartments,
        jobRoles: roles.map((r) => ({ _id: r._id, title: r.name, code: r.code, department: r.department ?? null })),
      },
      'Registration options'
    );
  }),
};
