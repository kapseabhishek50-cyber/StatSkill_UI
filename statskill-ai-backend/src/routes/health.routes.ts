import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const router = Router();

router.get('/', healthController.liveness);
router.get('/detailed', healthController.detailed);

export default router;
