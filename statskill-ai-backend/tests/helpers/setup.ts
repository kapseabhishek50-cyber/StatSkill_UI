import mongoose from 'mongoose';

let handle: { uri: string; stop: () => Promise<void>; kind: string } | null = null;

/** Boots a local MongoDB for tests (memory mongod, or EasyDB fallback). */
export const startTestDb = async (): Promise<string> => {
  const { startDevMongo } = await import('../../src/utils/devMongo');
  if (!handle) {
    handle = await startDevMongo({ dbName: `statskill-test-${Date.now().toString(36)}` });
  }
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(handle.uri, { serverSelectionTimeoutMS: 20000 });
  }
  return handle.uri;
};

export const clearDb = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
};

export const stopTestDb = async (): Promise<void> => {
  await mongoose.disconnect();
  if (handle) {
    await handle.stop();
    handle = null;
  }
};

export const appRequest = async () => {
  const { createApp } = await import('../../src/app');
  return createApp();
};
