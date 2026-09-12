import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { syncJob } from './jobs/sync.job';

const log = logger;

const start = async (): Promise<void> => {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    log.info(`StatSkill AI backend listening on http://0.0.0.0:${env.PORT} (env: ${env.NODE_ENV})`);
    log.info(`API docs: http://localhost:${env.PORT}/api/docs`);
  });

  // Background course sync scheduler (disabled when SYNC_INTERVAL_MINUTES=0).
  syncJob.startScheduler(env.SYNC_INTERVAL_MINUTES);

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`${signal} received — shutting down gracefully`);
    syncJob.stopScheduler();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit safety valve.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log.error({ reason: reason instanceof Error ? reason.message : reason }, 'unhandled rejection');
  });
  process.on('uncaughtException', (err) => {
    log.error({ err: err.message, stack: err.stack }, 'uncaught exception — exiting');
    process.exit(1);
  });
};

start().catch((err) => {
  log.error({ err: err.message, stack: err.stack }, 'Fatal startup error');
  process.exit(1);
});
