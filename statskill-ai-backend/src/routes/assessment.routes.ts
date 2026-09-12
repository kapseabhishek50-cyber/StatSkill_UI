import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { assessmentController } from '../controllers/assessment.controller';
import { validate } from '../middleware/validation.middleware';
import { startAssessmentSchema, submitAssessmentSchema, selfAssessmentSchema } from '../validators/assessment.validator';

const router = Router();

router.use(authenticate);
router.post('/start', validate({ body: startAssessmentSchema }), assessmentController.start);
router.post('/self', validate({ body: selfAssessmentSchema }), assessmentController.selfAssess);
router.post('/:id/submit', validate({ body: submitAssessmentSchema }), assessmentController.submit);
router.get('/:id', assessmentController.getById);
router.get('/history/me', assessmentController.history);

export default router;
