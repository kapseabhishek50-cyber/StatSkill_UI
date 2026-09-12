import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type LearningActivityType =
  | 'LESSON_COMPLETED'
  | 'QUIZ_COMPLETED'
  | 'COURSE_STARTED'
  | 'COURSE_COMPLETED'
  | 'ASSESSMENT_COMPLETED'
  | 'DISCUSSION_PARTICIPATION'
  | 'MATERIAL_READ'
  | 'PATH_STEP_COMPLETED';

/**
 * One record per meaningful learning activity (prompt §19). Simple logins are
 * deliberately NOT learning activities.
 */
export interface ILearningActivity extends Document {
  userId: Types.ObjectId;
  type: LearningActivityType;
  refType?: string; // 'course' | 'quiz' | 'assessment' | 'community' | 'material' | 'path'
  refId?: Types.ObjectId;
  title?: string;
  xpAwarded: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const learningActivitySchema = new Schema<ILearningActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    refType: { type: String },
    refId: { type: Schema.Types.ObjectId },
    title: { type: String },
    xpAwarded: { type: Number, default: 0, min: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

learningActivitySchema.index({ userId: 1, createdAt: -1 });
learningActivitySchema.index({ createdAt: -1 });

export const LearningActivity: Model<ILearningActivity> = models.LearningActivity || model<ILearningActivity>('LearningActivity', learningActivitySchema);
export default LearningActivity;
