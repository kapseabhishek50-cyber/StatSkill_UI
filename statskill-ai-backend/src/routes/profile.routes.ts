import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { profileController } from '../controllers/profile.controller';
import { validate } from '../middleware/validation.middleware';
import { updateProfileSchema } from '../validators/profile.validator';

const router = Router();

router.use(authenticate);
router.get('/me', profileController.getProfile);
router.get('/learning-profile', profileController.getLearningProfile);
router.put('/me', validate({ body: updateProfileSchema }), profileController.updateProfile);

export default router;
