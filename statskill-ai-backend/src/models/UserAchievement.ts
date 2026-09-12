import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IUserAchievement extends Document {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  progress: number; // 0-100 at unlock time
  isNotified: boolean;
  unlockedAt: Date;
}

const userAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    achievementId: { type: Schema.Types.ObjectId, ref: 'Achievement', required: true, index: true },
    progress: { type: Number, default: 100, min: 0, max: 100 },
    isNotified: { type: Boolean, default: false },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

export const UserAchievement: Model<IUserAchievement> = models.UserAchievement || model<IUserAchievement>('UserAchievement', userAchievementSchema);
export default UserAchievement;
