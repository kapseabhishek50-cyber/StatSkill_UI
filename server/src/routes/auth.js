import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Department, JobRole, User, Profile } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';

/**
 * Authentication routes.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 *  - Sign-in is rate limited per IP. Without it, a JWT login endpoint is an
 *    offline-speed password oracle reachable over HTTP.
 *  - A wrong email and a wrong password return the same message. Distinguishing
 *    them tells an attacker which officer accounts exist.
 */

const router = Router();

const signInLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const registration = credentials.extend({
  name: z.string().min(2).max(120),
  employeeId: z.string().max(40).optional(),
  department: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  jobRole: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

router.get('/register/options', asyncHandler(async (_req, res) => {
  const [departments, jobRoles] = await Promise.all([
    Department.find().select('name code').sort({ name: 1 }).lean(),
    JobRole.find().select('title code department').populate('department', 'name').sort({ title: 1 }).lean(),
  ]);
  res.json({ departments, jobRoles });
}));

/** Role is never taken from the request body - self-promotion to admin is not on offer. */
router.post(
  '/register',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registration.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Check the details you entered.', parsed.error.flatten().fieldErrors);
    }

    const { email, password, name, employeeId, department, jobRole } = parsed.data;
    if (await User.exists({ email: email.toLowerCase() })) {
      throw new HttpError(409, 'An account with that email already exists.');
    }

    if (department && !(await Department.exists({ _id: department }))) {
      throw new HttpError(400, 'Choose a valid department.');
    }
    if (jobRole) {
      const selectedRole = await JobRole.findById(jobRole).select('department').lean();
      if (!selectedRole) throw new HttpError(400, 'Choose a valid job role.');
      if (department && selectedRole.department && String(selectedRole.department) !== String(department)) {
        throw new HttpError(400, 'Choose a job role from the selected department.');
      }
    }

    const user = await User.create({
      email,
      name,
      employeeId,
      department,
      jobRole,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'learner',
    });

    await Profile.create({ user: user._id });

    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  }),
);

router.post(
  '/login',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Enter an email and password.');

    const { email, password } = parsed.data;
    // passwordHash is select:false on the schema, so ask for it explicitly.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Email or password is incorrect.');

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ token: signToken(user), user: user.toPublic() });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate('department jobRole');
    res.json({
      user: {
        ...user.toPublic(),
        department: user.department ? { _id: user.department._id, name: user.department.name } : null,
        jobRole: user.jobRole ? { _id: user.jobRole._id, title: user.jobRole.title } : null,
      },
    });
  }),
);

export default router;
