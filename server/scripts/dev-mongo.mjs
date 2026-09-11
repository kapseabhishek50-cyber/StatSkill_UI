/**
 * Boots a real mongod (binary downloaded on first run by mongodb-memory-server)
 * on 127.0.0.1:27017 so the API can serve live data in sandboxes/demos where no
 * system MongoDB is installed. Data is ephemeral: run `npm run seed` afterwards.
 *
 * When the mongod binary cannot be downloaded (restricted sandboxes), it falls
 * back to a SQLite-backed MongoDB-compatible server (see easydb-mongo.mjs); the
 * API cannot tell the difference for this app's queries.
 *
 *   node scripts/dev-mongo.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod = null;
try {
  mongod = await MongoMemoryServer.create({
    instance: { port: 27017, ip: '127.0.0.1', dbName: 'statskill' },
  });
} catch (error) {
  const reason = (error.message || String(error)).split('\n')[0];
  console.warn(`[dev-mongo] mongodb-memory-server unavailable: ${reason}`);
  console.warn('[dev-mongo] falling back to the SQLite-backed EasyDB server.');
  const { startEasyDb } = await import('./easydb-mongo.mjs');
  startEasyDb();
}

if (mongod) {
  console.log(`[dev-mongo] mongod ready at ${mongod.getUri()} (ephemeral — seed with npm run seed)`);

  function shutdown() {
    mongod.stop().then(() => process.exit(0));
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
