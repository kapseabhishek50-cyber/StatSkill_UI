import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { adminController } from '../controllers/admin.controller';
import { validate } from '../middleware/validation.middleware';
import { createCourseSchema, updateCourseSchema } from '../validators/course.validator';
import { mongoIdSchema } from '../validators/auth.validator';
import { z } from 'zod';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/dashboard', adminController.dashboard);
router.get('/users', adminController.users);
router.put('/users/:id/role', validate({ body: z.object({ role: z.enum(['LEARNER', 'TRAINER', 'ADMIN']) }), params: z.object({ id: mongoIdSchema }) }), adminController.updateUserRole);
router.put('/users/:id/active', validate({ params: z.object({ id: mongoIdSchema }) }), adminController.toggleUserActive);
router.get('/competencies', adminController.competencies);
router.get('/skill-gaps', adminController.skillGaps);
router.get('/courses', adminController.courses);
router.post('/courses', validate({ body: createCourseSchema }), adminController.createCourse);
router.put('/courses/:id', validate({ body: updateCourseSchema }), adminController.updateCourse);
router.post('/course-sync', adminController.syncCourses);
router.get('/providers', adminController.providerStatus);
router.get('/audit-logs', adminController.auditLogs);
router.get('/analytics', adminController.analytics);

export default router;
