import dns from "dns";
dns.setServers([
    '1.1.1.1',
    '8.8.8.8'
]);

import { createApp } from './app.js';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { llmProviderName } from './services/llm/index.js';

const mongooseReady = () => mongoose.connection.readyState === 1;

/**
 * Entry point. Production still refuses to serve without the database; in
 * development the API now boots degraded instead of dying, so the site and the
 * health endpoint stay reachable during a demo even when mongod is not up yet.
 * A background retry heals the connection the moment MongoDB appears.
 */

async function main() {
  let dbUp = false;
  try {
    await connectDb();
    dbUp = true;
  } catch {
    if (env.isProd) throw new Error('Database unavailable — refusing to serve in production.');
    console.warn('[api] booting DEGRADED without a database. Live data endpoints fall back to snapshots.');
  }

  if (!dbUp) {
    const retry = setInterval(async () => {
      if (mongooseReady()) {
        clearInterval(retry);
        return;
      }
      if (mongoose.connection.readyState === 2) return; // a connect is already in flight
      try {
        await connectDb(undefined, { quiet: true });
        clearInterval(retry);
        console.log('[api] database healed — live data endpoints are now serving.');
      } catch {
        /* keep retrying quietly */
      }
    }, 5000);
    retry.unref?.();
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://127.0.0.1:${env.port} (${env.nodeEnv})`);
    console.log(`[api] llm provider: ${llmProviderName()}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`[api] port ${env.port} is already in use; using the existing API instance.`);
      server.close(() => process.exit(0));
      return;
    }
    console.error('[api] server error:', error);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, closing.`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[api] failed to start:', error.message);
  process.exit(1);
});
