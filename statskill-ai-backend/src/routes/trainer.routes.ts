import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { trainerController } from '../controllers/trainer.controller';
import { materialController } from '../controllers/material.controller';
import { quizController } from '../controllers/quiz.controller';
import { upload } from '../middleware/upload.middleware';
import { validate } from '../middleware/validation.middleware';
import { createQuizSchema, updateQuizSchema, generateQuizSchema } from '../validators/quiz.validator';

const router = Router();

// Trainers and admins only.
router.use(authenticate, requireRole('TRAINER', 'ADMIN'));

router.post('/materials', upload.single('file'), materialController.upload);
router.get('/materials', trainerController.materials);

router.post('/quizzes/generate', validate({ body: generateQuizSchema }), quizController.generate);
router.get('/quizzes', trainerController.quizzes);
router.post('/quizzes', validate({ body: createQuizSchema }), quizController.create);
router.get('/quizzes/:id/review', trainerController.quizReview);
router.put('/quizzes/:id', validate({ body: updateQuizSchema }), trainerController.updateQuiz);
router.post('/quizzes/:id/publish', trainerController.publishQuiz);
router.post('/quizzes/:id/archive', trainerController.archiveQuiz);
router.get('/quizzes/:id/results', trainerController.quizResults);

router.get('/learners', trainerController.learners);
router.get('/analytics', trainerController.analytics);

export default router;
