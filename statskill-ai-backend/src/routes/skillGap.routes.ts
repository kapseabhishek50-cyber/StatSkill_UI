import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { skillGapController } from '../controllers/skillGap.controller';

const router = Router();

router.use(authenticate);
router.get('/me', skillGapController.myGaps);

export default router;
