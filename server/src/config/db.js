import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.mongoUri, { quiet = false } = {}) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    const { host, name } = mongoose.connection;
    console.log(`[db] connected to ${host}/${name}`);
  } catch (error) {
    if (!quiet) {
      console.error(
        `[db] could not connect to ${uri}\n` +
          '      Start MongoDB locally (mongod) or point MONGODB_URI at an Atlas cluster.',
      );
    }
    throw error;
  }
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
