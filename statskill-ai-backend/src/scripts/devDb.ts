/**
 * Standalone development database: boots an in-memory mongod (or the EasyDB
 * SQLite fallback) on a fixed port so multiple processes (API, seed, scripts)
 * can share one database.
 *
 *   MONGO_PORT=27017 npx tsx src/scripts/devDb.ts
 */
import mongoose from 'mongoose';
import 'dotenv/config';
import { startDevMongo } from '../utils/devMongo';
import { getLogger } from '../utils/logger';

const log = getLogger('devDb');
const port = Number(process.env.MONGO_PORT ?? 27017);

const main = async () => {
  const handle = await startDevMongo({ dbName: 'statskill', port, dataDir: '.dev-data' });
  log.info(`Dev database ready on port ${port} (${handle.kind}) — uri: ${handle.uri}`);

  const shutdown = async () => {
    await mongoose.disconnect().catch(() => undefined);
    await handle.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  // Keep alive.
  setInterval(() => undefined, 1 << 30);
};

main().catch((err) => {
  log.error({ err: err.message }, 'dev database failed to start');
  process.exit(1);
});
