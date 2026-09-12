import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { quizController } from '../controllers/quiz.controller';
import { validate } from '../middleware/validation.middleware';
import { submitQuizSchema } from '../validators/quiz.validator';

const router = Router();

router.use(optionalAuth);
router.get('/', quizController.listPublished);
router.get('/attempts/me', authenticate, quizController.myAttempts);
router.get('/:id', quizController.getForLearner);
router.post('/:id/submit', authenticate, validate({ body: submitQuizSchema }), quizController.submit);

export default router;
