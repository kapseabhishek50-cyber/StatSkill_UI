import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IMessageReport {
  userId: Types.ObjectId;
  reason: string;
  createdAt: Date;
}

/**
 * Community message. REST CRUD + moderation lives here; realtime delivery is
 * delegated to Firebase (or any realtime provider) — this model is the source
 * of truth for authorization and moderation.
 */
export interface IMessage extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  replyToId?: Types.ObjectId;
  isDeleted: boolean;
  deletedBy?: Types.ObjectId;
  autoHidden: boolean;
  reportCount: number;
  reports: IMessageReport[];
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, maxlength: 2000 },
    replyToId: { type: Schema.Types.ObjectId, ref: 'Message' },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    autoHidden: { type: Boolean, default: false, index: true },
    reportCount: { type: Number, default: 0, min: 0 },
    reports: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ communityId: 1, createdAt: -1 });

export const Message: Model<IMessage> = models.Message || model<IMessage>('Message', messageSchema);
export default Message;
