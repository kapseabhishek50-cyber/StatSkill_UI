import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger';

const log = logger;

export interface DevMongoHandle {
  uri: string;
  stop: () => Promise<void>;
  kind: 'memory' | 'easydb';
}

const waitForPort = (port: number, host: string, timeoutMs = 30000): Promise<void> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tryConnect = (): void => {
      const socket = net.connect({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) return reject(new Error('dev mongo port never opened'));
        setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });

/**
 * Zero-infrastructure MongoDB for development/test environments:
 *   1. Preferred: real mongod via mongodb-memory-server (ephemeral).
 *   2. Fallback (binary download unavailable): EasyDB — a SQLite-backed
 *      MongoDB-compatible server, pure Node (same approach as the prototype).
 * The application cannot tell the difference for this app's queries.
 */
export const startDevMongo = async (opts: { dbName: string; dataDir?: string; port?: number } = { dbName: 'statskill' }): Promise<DevMongoHandle> => {
  // 1) Real mongod (in-memory) when the binary can be fetched.
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      instance: { dbName: opts.dbName, ...(opts.port ? { port: opts.port, ip: '127.0.0.1' } : {}) },
    });
    return {
      uri: mongod.getUri(opts.dbName),
      kind: 'memory',
      stop: async () => {
        await mongod.stop();
      },
    };
  } catch (err) {
    log.warn(`mongodb-memory-server unavailable: ${(err as Error).message.split('\n')[0]}`);
  }

  // 2) EasyDB SQLite fallback.
  const { createRequire } = await import('module');
  const req = createRequire(path.resolve(process.cwd(), 'package.json'));
  const pkgJsonPath = req.resolve('@rckflr/easydb-server/package.json');
  const binPath = path.join(path.dirname(pkgJsonPath), 'bin', 'easydb-server.js');
  const port = opts.port ?? (20000 + Math.floor(Math.random() * 20000));
  const dataDir = opts.dataDir ?? path.resolve(process.cwd(), '.dev-data', crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dataDir, { recursive: true });

  const child: ChildProcess = spawn(
    process.execPath,
    [binPath, '--adapter', 'sqlite', '--data', dataDir, '--host', '127.0.0.1', '--port', String(port), '--quiet'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stderr?.on('data', (d) => log.warn(`[easydb] ${String(d).trim().slice(0, 200)}`));

  await waitForPort(port, '127.0.0.1');
  log.info(`EasyDB (SQLite-backed MongoDB-compatible) ready at 127.0.0.1:${port}`);

  return {
    uri: `mongodb://127.0.0.1:${port}/${opts.dbName}`,
    kind: 'easydb',
    stop: async () => {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        setTimeout(resolve, 2000).unref();
      });
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    },
  };
};
