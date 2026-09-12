import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { leaderboardController } from '../controllers/leaderboard.controller';

const router = Router();

router.use(authenticate);
router.get('/', leaderboardController.standings);

export default router;
