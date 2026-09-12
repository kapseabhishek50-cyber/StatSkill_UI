import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import profileRoutes from './profile.routes';
import assessmentRoutes from './assessment.routes';
import competencyRoutes from './competency.routes';
import skillGapRoutes from './skillGap.routes';
import recommendationRoutes from './recommendation.routes';
import courseRoutes from './course.routes';
import learningRoutes from './learning.routes';
import quizRoutes from './quiz.routes';
import materialRoutes from './material.routes';
import streakRoutes from './streak.routes';
import achievementRoutes from './achievement.routes';
import communityRoutes from './community.routes';
import notificationRoutes from './notification.routes';
import aiRoutes from './ai.routes';
import trainerRoutes from './trainer.routes';
import adminRoutes from './admin.routes';
import healthRoutes from './health.routes';
import searchRoutes from './search.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', userRoutes); // GET /api/dashboard
router.use('/profile', profileRoutes);
router.use('/assessment', assessmentRoutes);
router.use('/competencies', competencyRoutes);
router.use('/skill-gaps', skillGapRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/courses', courseRoutes);
router.use('/learning', learningRoutes);
router.use('/quizzes', quizRoutes);
router.use('/materials', materialRoutes);
router.use('/streak', streakRoutes);
router.use('/achievements', achievementRoutes);
router.use('/communities', communityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/trainer', trainerRoutes);
router.use('/admin', adminRoutes);
router.use('/search', searchRoutes);
router.use('/health', healthRoutes);

export default router;
