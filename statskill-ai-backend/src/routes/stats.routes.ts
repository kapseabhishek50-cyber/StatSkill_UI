import { Router } from 'express';
import { statsController } from '../controllers/stats.controller';

const router = Router();

// Public — safe to embed in the marketing site.
router.get('/public', statsController.publicStats);

export default router;
