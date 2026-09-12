import { Schema, model, models, Model, Document, Types } from 'mongoose';

/** Granular per-item progress records behind the Enrollment aggregate. */
export interface ILearningProgress extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  itemType: 'LESSON' | 'MODULE' | 'MATERIAL';
  itemIndex: number;
  itemTitle?: string;
  timeSpentMinutes: number;
  completedAt: Date;
  createdAt: Date;
}

const learningProgressSchema = new Schema<ILearningProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    itemType: { type: String, enum: ['LESSON', 'MODULE', 'MATERIAL'], default: 'MODULE' },
    itemIndex: { type: Number, required: true, min: 0 },
    itemTitle: { type: String },
    timeSpentMinutes: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

learningProgressSchema.index({ userId: 1, courseId: 1, itemIndex: 1 }, { unique: true });

export const LearningProgress: Model<ILearningProgress> = models.LearningProgress || model<ILearningProgress>('LearningProgress', learningProgressSchema);
export default LearningProgress;
