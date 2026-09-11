import { Router } from 'express';
import { z } from 'zod';
import { Course } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

const courseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  title: z.string().min(1, 'Course title is required'),
  provider: z.enum(['iGOT', 'NSSTA', 'internal', 'other']),
  url: z.string().optional(),
  description: z.string().optional(),
  durationHours: z.number().nonnegative().optional(),
  modality: z.enum(['self_paced', 'instructor_led', 'blended']).optional(),
  competencies: z.array(z.object({
    competency: z.string(),
    targetLevel: z.number().min(0).max(5),
    weight: z.number().min(0).max(1)
  })).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
});

const courseUpdateSchema = courseSchema.partial();

router.get(
  '/',
  audit('admin.courses.read'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.provider) {
      filter.provider = req.query.provider;
    }
    const courses = await Course.find(filter).populate('competencies.competency').sort({ title: 1 });
    res.json({ courses });
  })
);

router.post(
  '/',
  audit('admin.courses.create'),
  asyncHandler(async (req, res) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Check the course details.', parsed.error.flatten().fieldErrors);

    const data = parsed.data;
    const course = await Course.create(data);
    res.status(201).json(course);
  }),
);

router.patch(
  '/:id',
  audit('admin.courses.update'),
  asyncHandler(async (req, res) => {
    const parsed = courseUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Check the course details.', parsed.error.flatten().fieldErrors);

    const data = parsed.data;
    const course = await Course.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!course) {
      throw new HttpError(404, 'Course not found.');
    }
    res.json(course);
  }),
);

router.delete(
  '/:id',
  audit('admin.courses.delete'),
  asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!course) {
      throw new HttpError(404, 'Course not found.');
    }
    res.json({ message: 'Course deactivated.' });
  }),
);

export default router;
