import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { userController } from '../controllers/user.controller';

const router = Router();

/** GET /api/dashboard — single optimized dashboard endpoint (prompt §34). */
router.get('/dashboard', authenticate, userController.dashboard);

export default router;
