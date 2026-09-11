import { Router } from 'express';
import { Course, LearningProgress, QuizResult } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildGapRanking, buildHeatmap, rollup } from '../services/workforce.js';

/**
 * Admin analytics.
 *
 * Two guards, both server-side, on every route in this file: the role check, and
 * an audit entry. Hiding the menu item in the client is not access control, and a
 * read of workforce competency data that leaves no trace is not one an officer can
 * later ask about. The routes return aggregates only - there is no endpoint here
 * that names an individual.
 */

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get(
  '/overview',
  audit('admin.overview.read'),
  asyncHandler(async (_req, res) => {
    const [data, quizzesTaken, coursesEnrolled, catalogue] = await Promise.all([
      rollup(),
      QuizResult.countDocuments({ status: 'submitted' }),
      LearningProgress.countDocuments({}),
      Course.countDocuments({ isActive: true }),
    ]);

    const { officers } = data;
    const meanReadiness = officers.length
      ? Number(
          (officers.reduce((sum, officer) => sum + officer.readiness, 0) / officers.length).toFixed(4),
        )
      : 0;

    res.json({
      officers: officers.length,
      divisions: new Set(officers.map((officer) => officer.departmentId).filter(Boolean)).size,
      meanReadiness,
      officersWithGaps: officers.filter((officer) => officer.hasOpenGap).length,
      quizzesTaken,
      coursesEnrolled,
      catalogue,
    });
  }),
);

router.get(
  '/heatmap',
  audit('admin.heatmap.read'),
  asyncHandler(async (_req, res) => {
    res.json(buildHeatmap(await rollup()));
  }),
);

router.get(
  '/gaps',
  audit('admin.gaps.read'),
  asyncHandler(async (req, res) => {
    const departmentId = /^[a-f\d]{24}$/i.test(String(req.query.department ?? ''))
      ? String(req.query.department)
      : null;

    const rows = buildGapRanking(await rollup(), { departmentId });
    res.json({ rows, department: departmentId });
  }),
);

export default router;
