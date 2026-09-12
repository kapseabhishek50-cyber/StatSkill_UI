import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  employeeId: z.string().max(40).optional(),
  role: z.enum(['LEARNER', 'TRAINER']).optional(),
  designation: z.string().max(120).optional(),
  /** Job-role reference from GET /auth/register/options (role id or role name). */
  jobRole: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  organization: z.string().max(160).optional(),
  experience: z.coerce.number().min(0).max(50).optional(),
  education: z.string().max(160).optional(),
  preferredLanguage: z.string().max(10).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');
