import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { learningController } from '../controllers/learning.controller';

const router = Router();

router.use(authenticate);

// Learning paths
router.get('/paths', learningController.listPaths);
router.post('/paths/generate', learningController.generatePath);
router.get('/paths/active', learningController.getPath);

// Progress / activity
router.get('/activity', learningController.activity);
router.get('/summary', learningController.summary);

// Enrollments
router.post('/enroll/:courseId', learningController.enroll);
router.get('/my-courses', learningController.myCourses);
router.get('/:courseId/progress', learningController.getProgress);
router.put('/:courseId/progress', learningController.updateProgress);
router.post('/:courseId/complete', learningController.complete);
router.get('/:courseId/timeline', learningController.timeline);

export default router;
