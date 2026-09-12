import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { achievementController } from '../controllers/achievement.controller';

const router = Router();

router.use(authenticate);
router.get('/', achievementController.listAll);
router.get('/me', achievementController.myAchievements);

export default router;
