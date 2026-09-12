import { enqueueJob } from './queue';
import { notificationService } from '../services/notification/notification.service';

export const notificationJob = {
  name: 'notification.send',

  /** Offloads bulk fan-out from request threads. */
  enqueueBulk(inputs: Parameters<typeof notificationService.pushMany>[0]): void {
    void enqueueJob(
      this.name,
      async () => { await notificationService.pushMany(inputs); },
      this.name
    ).catch(() => undefined);
  },

  enqueueUserNotification(input: Parameters<typeof notificationService.push>[0]): void {
    void enqueueJob(
      this.name,
      async () => { await notificationService.push(input); },
      this.name
    ).catch(() => undefined);
  },
};
