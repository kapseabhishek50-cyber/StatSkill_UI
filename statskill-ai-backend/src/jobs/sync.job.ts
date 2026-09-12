import { enqueueJob } from './queue';
import { courseSyncService } from '../services/integrations/courseSync.service';
import { logger } from '../utils/logger';

const log = logger;

let schedulerTimer: NodeJS.Timeout | null = null;

export const syncJob = {
  name: 'course.sync',

  enqueue(trigger: 'manual' | 'scheduled' = 'manual'): void {
    void enqueueJob(
      this.name,
      async () => {
        const result = await courseSyncService.syncAll(trigger);
        log.info({ result }, 'course sync job finished');
      },
      this.name
    ).catch((err) => log.warn({ err: (err as Error).message }, 'sync enqueue failed'));
  },

  /** Starts the periodic sync scheduler (disabled when SYNC_INTERVAL_MINUTES=0). */
  startScheduler(intervalMinutes: number): void {
    if (intervalMinutes <= 0 || schedulerTimer) return;
    schedulerTimer = setInterval(
      () => {
        this.enqueue('scheduled');
      },
      intervalMinutes * 60 * 1000
    );
    schedulerTimer.unref();
    log.info({ intervalMinutes }, 'course sync scheduler started');
  },

  stopScheduler(): void {
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = null;
  },
};
