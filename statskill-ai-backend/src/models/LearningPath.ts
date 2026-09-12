import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IPathStep {
  order: number;
  courseId: Types.ObjectId;
  title: string;
  level: string;
  competencyIds: Types.ObjectId[];
  reason?: string; // why this course is in the path
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  prerequisiteIds: Types.ObjectId[];
}

export interface ILearningPath extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  targetSkills: string[]; // competency codes
  steps: IPathStep[];
  currentStep: number;
  progress: number; // 0-100
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  generatedBy: 'RULE' | 'AI';
  reasoning?: string; // optional AI narrative (never authoritative)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stepSchema = new Schema<IPathStep>(
  {
    order: { type: Number, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    level: { type: String, default: 'BEGINNER' },
    competencyIds: { type: [Schema.Types.ObjectId], ref: 'Competency', default: [] },
    reason: { type: String },
    status: { type: String, enum: ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED'], default: 'AVAILABLE' },
    prerequisiteIds: { type: [Schema.Types.ObjectId], ref: 'Course', default: [] },
  },
  { _id: false }
);

const learningPathSchema = new Schema<ILearningPath>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    targetSkills: { type: [String], default: [], index: true },
    steps: { type: [stepSchema], default: [] },
    currentStep: { type: Number, default: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE', index: true },
    generatedBy: { type: String, enum: ['RULE', 'AI'], default: 'RULE' },
    reasoning: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

learningPathSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const LearningPath: Model<ILearningPath> = models.LearningPath || model<ILearningPath>('LearningPath', learningPathSchema);
export default LearningPath;
