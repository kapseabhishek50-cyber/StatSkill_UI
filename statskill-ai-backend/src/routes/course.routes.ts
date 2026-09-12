import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { courseController } from '../controllers/course.controller';

const router = Router();

router.use(optionalAuth);
router.get('/', courseController.list);
router.get('/search', courseController.search);
router.get('/categories', courseController.categories);
router.get('/category/:category', courseController.byCategory);
router.get('/skill/:skill', courseController.bySkill);
router.get('/:id', courseController.getById);

export default router;
