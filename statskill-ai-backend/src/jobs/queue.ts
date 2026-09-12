import { logger } from '../utils/logger';

const log = logger;

export interface JobEnvelope {
  id: string;
  name: string;
}

/**
 * Lightweight in-process job queue with concurrency + retry/backoff.
 * Interface-compatible with a BullMQ worker: swap the internals for Redis in
 * multi-instance deployments (REDIS_URL) without touching callers.
 */
type JobFn = () => Promise<void>;

interface QueueJob {
  id: string;
  name: string;
  fn: JobFn;
  attempts: number;
  maxAttempts: number;
}

const CONCURRENCY = 3;
const queue: QueueJob[] = [];
let active = 0;
let running = false;
const counters = new Map<string, number>();

export const enqueueJob = async (name: string, fn: JobFn, jobLabel?: string, maxAttempts = 3): Promise<JobEnvelope> => {
  const job: QueueJob = {
    id: `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    name: jobLabel ?? name,
    fn,
    attempts: 0,
    maxAttempts,
  };
  queue.push(job);
  counters.set(name, (counters.get(name) ?? 0) + 1);
  void drain();
  return { id: job.id, name: job.name };
};

const drain = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      while (active >= CONCURRENCY) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const job = queue.shift();
      if (!job) break;
      active += 1;
      void runJob(job).finally(() => {
        active -= 1;
      });
    }
    // wait for stragglers
    while (active > 0) await new Promise((r) => setTimeout(r, 50));
  } finally {
    running = false;
  }
};

const runJob = async (job: QueueJob): Promise<void> => {
  const start = Date.now();
  try {
    await job.fn();
    log.info({ jobId: job.id, name: job.name, ms: Date.now() - start }, 'job completed');
  } catch (err) {
    job.attempts += 1;
    if (job.attempts < job.maxAttempts) {
      const backoff = Math.min(30000, 500 * 2 ** job.attempts);
      log.warn({ jobId: job.id, name: job.name, attempt: job.attempts, backoffMs: backoff, err: (err as Error).message }, 'job failed — retrying');
      setTimeout(() => {
        queue.push(job);
        void drain();
      }, backoff);
    } else {
      log.error({ jobId: job.id, name: job.name, err: (err as Error).message }, 'job failed permanently');
    }
  }
};

export const queueStats = () => ({
  pending: queue.length,
  active,
  enqueuedByType: Object.fromEntries(counters),
});

/** Waits until the queue is fully drained (used by tests/seed). */
export const drainQueue = async (): Promise<void> => {
  while (queue.length || active > 0 || running) {
    await new Promise((r) => setTimeout(r, 50));
  }
};
