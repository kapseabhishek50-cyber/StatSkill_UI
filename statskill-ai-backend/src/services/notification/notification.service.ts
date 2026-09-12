import { Notification, INotification, NotificationType } from '../../models/Notification';
import { User } from '../../models/User';
import { sendPushNotification } from '../../config/firebase';
import { logger } from '../../utils/logger';

const log = logger;

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const notificationService = {
  async push(input: CreateNotificationInput): Promise<INotification | null> {
    try {
      const notification = await Notification.create(input);
      // Optional realtime/push delivery — never blocks the calling flow.
      void sendPushNotification({
        topic: `user-${input.userId}`,
        notification: { title: input.title, body: input.body },
        data: input.data ?? {},
      }).catch(() => undefined);
      return notification;
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'notification create failed');
      return null;
    }
  },

  async pushMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (!inputs.length) return;
    try {
      await Notification.insertMany(inputs, { ordered: false });
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'bulk notification create failed');
    }
  },

  async list(userId: string, opts: { page: number; limit: number; unreadOnly?: boolean; skip?: number }) {
    const filter: Record<string, unknown> = { userId };
    if (opts.unreadOnly) filter.isRead = false;
    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(opts.skip ?? (opts.page - 1) * opts.limit).limit(opts.limit),
      Notification.countDocuments(filter),
    ]);
    return { items, total };
  },

  async unreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  },

  async markRead(userId: string, notificationId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  },

  async markAllRead(userId: string): Promise<number> {
    const res = await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
    return res.modifiedCount;
  },

  /** Notify all active learners (used for quiz publication). */
  async notifyLearners(input: Omit<CreateNotificationInput, 'userId'>, cap = 500): Promise<number> {
    const users = await User.find({ role: 'LEARNER', isActive: true }).select('_id').limit(cap);
    await this.pushMany(users.map((u) => ({ ...input, userId: String(u._id) })));
    return users.length;
  },
};
