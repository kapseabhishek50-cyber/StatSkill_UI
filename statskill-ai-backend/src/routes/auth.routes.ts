import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema } from '../validators/auth.validator';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.get('/register/options', authController.registerOptions);
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authLimiter, validate({ body: refreshSchema.optional() }), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/password', authenticate, validate({ body: changePasswordSchema }), authController.changePassword);

export default router;
