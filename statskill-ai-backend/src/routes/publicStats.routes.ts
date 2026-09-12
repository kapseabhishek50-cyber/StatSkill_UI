import { Router } from 'express';
import { publicStatsController } from '../controllers/publicStats.controller';

/**
 * Public, unauthenticated platform numbers for the landing page.
 *
 * Mounted by routes/index.ts as `/stats`, so the full path is
 * `GET /api/stats/public` — the same URL the existing frontend already calls
 * against the legacy server, which is what lets the TS backend be swapped in
 * without a frontend change.
 */
const router = Router();

router.get('/public', publicStatsController.snapshot);

export default router;
