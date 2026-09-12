import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { recommendationController } from '../controllers/recommendation.controller';

const router = Router();

router.use(authenticate);
router.get('/', recommendationController.list);
router.get('/top', recommendationController.top);
router.get('/for-skill/:skillId', recommendationController.forSkill);
router.post('/refresh', recommendationController.refresh);
router.put('/:id/dismiss', recommendationController.dismiss);

export default router;
