import { Router } from 'express';
import { Competency, Course, Department, JobRole } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { PROFICIENCY_LEVELS, PRIORITY_BANDS, QUIZ_PASS_RATIO } from '../config/competency.js';

/**
 * The framework itself: competencies, roles, divisions, courses, and the scale.
 *
 * Read-only and shared by both audiences. Publishing the scale and the band
 * thresholds is what lets a learner check a score rather than take it on trust.
 */

const router = Router();

router.use(requireAuth);

router.get(
  '/competencies',
  asyncHandler(async (_req, res) => {
    const competencies = await Competency.find()
      .select('code name description category nsqfLevel futureDemand tags')
      .sort({ category: 1, code: 1 })
      .lean();
    res.json({ competencies });
  }),
);

router.get(
  '/job-roles',
  asyncHandler(async (_req, res) => {
    const roles = await JobRole.find()
      .populate('requirements.competency', 'code name category')
      .populate('department', 'code name')
      .sort({ title: 1 })
      .lean();
    res.json({ roles });
  }),
);

router.get(
  '/departments',
  asyncHandler(async (_req, res) => {
    const departments = await Department.find().sort({ name: 1 }).lean();
    res.json({ departments });
  }),
);

router.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (/^[a-f\d]{24}$/i.test(String(req.query.competency ?? ''))) {
      filter['competencies.competency'] = String(req.query.competency);
    }
    if (['iGOT', 'NSSTA', 'internal', 'other'].includes(String(req.query.provider))) {
      filter.provider = String(req.query.provider);
    }

    const courses = await Course.find(filter)
      .populate('competencies.competency', 'code name category')
      .sort({ rating: -1, title: 1 })
      .limit(200)
      .lean();
    res.json({ courses });
  }),
);

/** The scale, the bands and the pass mark, straight from config. */
router.get('/scale', (_req, res) => {
  res.json({ levels: PROFICIENCY_LEVELS, bands: PRIORITY_BANDS, quizPassRatio: QUIZ_PASS_RATIO });
});

export default router;
