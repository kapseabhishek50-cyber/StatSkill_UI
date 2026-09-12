import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'COURSE_RECOMMENDED'
  | 'QUIZ_PUBLISHED'
  | 'QUIZ_COMPLETED'
  | 'STREAK_MILESTONE'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'COURSE_COMPLETED'
  | 'DISCUSSION_REPLY'
  | 'SYSTEM';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> = models.Notification || model<INotification>('Notification', notificationSchema);
export default Notification;
