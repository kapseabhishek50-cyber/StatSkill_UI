import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { databaseHealth } from '../config/database';
import { firebaseStatus } from '../config/firebase';
import { aiStatus } from '../services/ai/ai.service';
import { providerStatuses } from '../services/integrations';
import { queueStats } from '../jobs/queue';
import { env } from '../config/env';
import mongoose from 'mongoose';

const startedAt = Date.now();

export const healthController = {
  /** GET /api/health — cheap liveness probe. */
  liveness: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), version: '1.0.0', env: env.NODE_ENV }, 'Healthy');
  }),

  /** GET /api/health/detailed — component checks. */
  detailed: asyncHandler(async (_req: Request, res: Response) => {
    const [db, firebase] = await Promise.all([databaseHealth(), firebaseStatus()]);
    const dbLatency = db.latencyMs;
    const components: Record<string, unknown> = {
      api: { status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) },
      mongodb: { status: db.connected ? 'ok' : 'degraded', latencyMs: dbLatency, error: db.error },
      ai: aiStatus(),
      providers: providerStatuses(),
      firebase,
      redis: { configured: Boolean(env.REDIS_URL), status: env.REDIS_URL ? 'configured (external)' : 'not configured (in-process fallback)' },
      jobs: queueStats(),
      mongoose: { readyState: mongoose.connection.readyState },
    };
    const allCriticalOk = db.connected;
    sendSuccess(
      res,
      { status: allCriticalOk ? 'ok' : 'degraded', components },
      allCriticalOk ? 'Healthy' : 'Degraded'
    );
  }),
};
