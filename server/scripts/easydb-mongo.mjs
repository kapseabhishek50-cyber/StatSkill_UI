/**
 * Boots a MongoDB-compatible server on 127.0.0.1:27017 backed by SQLite,
 * using @rckflr/easydb-server (pure Node — no binary download). This is the
 * fallback for sandboxes where mongodb-memory-server cannot fetch a mongod
 * binary from fastdl.mongodb.org.
 *
 * Unlike the in-memory mongod, data here is persisted to server/.dev-data
 * (gitignored), so a seed survives restarts. Delete that directory for a
 * clean slate.
 *
 *   node scripts/easydb-mongo.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

const packageJson = require.resolve('@rckflr/easydb-server/package.json');
const binPath = path.join(path.dirname(packageJson), 'bin', 'easydb-server.js');
const dataDir = path.join(serverRoot, '.dev-data');
const port = Number(process.env.MONGO_PORT ?? 27017);

export function startEasyDb() {
  const child = spawn(
    process.execPath,
    [
      binPath,
      '--adapter', 'sqlite',
      '--data', dataDir,
      '--host', '127.0.0.1',
      '--port', String(port),
      '--quiet',
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[dev-mongo] easydb-server exited with code ${code}`);
      process.exit(code);
    }
  });

  function shutdown() {
    child.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1500).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    `[dev-mongo] easydb-server (SQLite-backed) starting on mongodb://127.0.0.1:${port} — data persisted in server/.dev-data`,
  );
  return child;
}

// Run directly: node scripts/easydb-mongo.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startEasyDb();
}
