import { Router } from 'express';
import authRoutes from './auth.js';
import profileRoutes from './profile.js';
import assessmentRoutes from './assessment.js';
import recommendRoutes from './recommend.js';
import quizRoutes from './quiz.js';
import learningRoutes from './learning.js';
import adminRoutes from './admin.js';
import adminOfficerRoutes from './adminOfficers.js';
import adminCourseRoutes from './adminCourses.js';
import adminQuestionRoutes from './adminQuestions.js';
import frameworkRoutes from './framework.js';
import assistantRoutes from './assistant.js';
import trainerRoutes from './trainer.js';
import discussionRoutes from './discussions.js';
import gamificationRoutes from './gamification.js';
import publicStatsRoutes from './publicStats.js';
import { checkAllServices } from '../services/healthMonitor.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * The API surface, mounted in one place so the URL space is legible at a glance.
 * The client's endpoint map (client/src/lib/api.js) mirrors these paths.
 */

const router = Router();

/**
 * Health check. Checks all integrated services and reports their status.
 * Used by monitoring, load balancers, and the admin Integration Center.
 */
router.get('/health', asyncHandler(async (_req, res) => {
  const healthStatus = await checkAllServices();
  res.json({
    ...healthStatus,
    env: env.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  });
}));

/**
 * Detailed integration status for the admin Integration Center.
 * Returns last sync, error history, and provider configuration.
 */
router.get(
  '/integrations/status',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const healthStatus = await checkAllServices();
    res.json(healthStatus);
  })
);

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/recommendations', recommendRoutes);
router.use('/quiz', quizRoutes);
router.use('/learning', learningRoutes);
router.use('/assistant', assistantRoutes);

// Realtime Discussion & Gamification
router.use('/discussions', discussionRoutes);
router.use('/gamification', gamificationRoutes);

// Trainer routes
router.use('/trainer', trainerRoutes);

// Admin routes
router.use('/admin/officers', adminOfficerRoutes);
router.use('/admin/courses', adminCourseRoutes);
router.use('/admin/questions', adminQuestionRoutes);
router.use('/admin', adminRoutes);

// Public landing-page numbers — no auth, safe to embed in the marketing site.
router.use('/stats', publicStatsRoutes);

// Framework reference data is mounted at the root: /competencies, /courses, ...
router.use('/', frameworkRoutes);

export default router;
