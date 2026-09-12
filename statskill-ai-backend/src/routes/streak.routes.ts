import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { streakController } from '../controllers/streak.controller';

const router = Router();

router.use(authenticate);
router.get('/', streakController.get);

export default router;
