import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { aiController } from '../controllers/ai.controller';
import { validate } from '../middleware/validation.middleware';
import { chatSchema } from '../validators/ai.validator';
import { aiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);
router.post('/chat', aiLimiter, validate({ body: chatSchema }), aiController.chat);
router.get('/status', aiController.status);
router.get('/test', aiController.test);
router.post('/study-plan', aiLimiter, aiController.studyPlan);

export default router;
