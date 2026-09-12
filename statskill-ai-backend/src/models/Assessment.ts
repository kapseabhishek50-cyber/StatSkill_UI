import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type AssessmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
export type AssessmentType = 'ROLE_BASED' | 'FULL' | 'COMPETENCY' | 'DIAGNOSTIC';
export type QuestionSource = 'BANK' | 'AI';

export interface IAssessmentQuestion {
  questionId: string;
  competencyId: Types.ObjectId;
  competencyCode?: string;
  question: string;
  options: string[];
  correctAnswer: number; // index 0-3 (never sent to learners)
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: QuestionSource;
}

export interface IAssessment extends Document {
  userId: Types.ObjectId;
  type: AssessmentType;
  status: AssessmentStatus;
  competencyIds: Types.ObjectId[];
  questions: IAssessmentQuestion[];
  config: {
    role?: string;
    department?: string;
    experienceYears?: number;
    basedOnGaps: boolean;
    generatedAt: Date;
  };
  startedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IAssessmentQuestion>(
  {
    questionId: { type: String, required: true },
    competencyId: { type: Schema.Types.ObjectId, ref: 'Competency', required: true },
    competencyCode: { type: String },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    source: { type: String, enum: ['BANK', 'AI'], default: 'BANK' },
  },
  { _id: false }
);

const assessmentSchema = new Schema<IAssessment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['ROLE_BASED', 'FULL', 'COMPETENCY', 'DIAGNOSTIC'], default: 'ROLE_BASED' },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED'], default: 'IN_PROGRESS', index: true },
    competencyIds: { type: [Schema.Types.ObjectId], ref: 'Competency', default: [] },
    questions: { type: [questionSchema], default: [] },
    config: {
      role: { type: String },
      department: { type: String },
      experienceYears: { type: Number },
      basedOnGaps: { type: Boolean, default: true },
      generatedAt: { type: Date, default: Date.now },
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

assessmentSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Assessment: Model<IAssessment> = models.Assessment || model<IAssessment>('Assessment', assessmentSchema);
export default Assessment;
