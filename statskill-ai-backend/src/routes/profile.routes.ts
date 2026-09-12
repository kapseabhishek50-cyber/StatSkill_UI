import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { profileController } from '../controllers/profile.controller';
import { validate } from '../middleware/validation.middleware';
import { updateProfileSchema } from '../validators/profile.validator';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.get('/me', profileController.getProfile);
router.get('/me/competencies', profileController.myCompetencies);
router.get('/me/requirements', profileController.myRequirements);
router.get('/learning-profile', profileController.getLearningProfile);
router.put('/me', validate({ body: updateProfileSchema }), profileController.updateProfile);
router.patch('/me', validate({ body: updateProfileSchema }), profileController.updateProfile);
router.post('/me/documents', upload.single('document'), profileController.uploadDocument);

export default router;
