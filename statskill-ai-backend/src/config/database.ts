import mongoose from 'mongoose';
import { env } from './env';
import { getLogger } from '../utils/logger';
import { startDevMongo, DevMongoHandle } from '../utils/devMongo';

const log = getLogger('database');

let devHandle: DevMongoHandle | null = null;

/**
 * Connects to MongoDB. In development/test, when MONGODB_URI is not set, a
 * local database is booted automatically (in-memory mongod, or the EasyDB
 * SQLite-backed fallback when the binary cannot be downloaded) so the backend
 * runs with zero infrastructure. Production requires a real URI.
 */
export const connectDatabase = async (): Promise<string> => {
  mongoose.set('strictQuery', true);

  let uri = env.MONGODB_URI;
  if (!uri) {
    if (env.isProduction) {
      throw new Error('MONGODB_URI is required in production');
    }
    devHandle = await startDevMongo({ dbName: 'statskill' });
    uri = devHandle.uri;
    log.info(`No MONGODB_URI set — started dev MongoDB (${devHandle.kind}) at ${uri}`);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  log.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return uri;
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  if (devHandle) {
    await devHandle.stop();
    devHandle = null;
  }
};

export const databaseHealth = async (): Promise<{ connected: boolean; latencyMs?: number; error?: string }> => {
  try {
    const start = Date.now();
    if (mongoose.connection.readyState !== 1) return { connected: false, error: 'not connected' };
    await mongoose.connection.db?.admin().ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, error: (err as Error).message };
  }
};
