import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IStreak extends Document {
  userId: Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  totalLearningDays: number;
  lastActivityDate?: Date; // UTC day-truncated
  lastMilestone: number; // highest milestone day count already rewarded
  createdAt: Date;
  updatedAt: Date;
}

const streakSchema = new Schema<IStreak>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    totalLearningDays: { type: Number, default: 0, min: 0 },
    lastActivityDate: { type: Date },
    lastMilestone: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const Streak: Model<IStreak> = models.Streak || model<IStreak>('Streak', streakSchema);
export default Streak;
