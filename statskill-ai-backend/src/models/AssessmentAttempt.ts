import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface ICompetencyResult {
  competencyId: Types.ObjectId;
  competencyCode?: string;
  correct: number;
  total: number;
  scorePercent: number;
  previousScore?: number;
  newScore?: number;
}

export interface IAssessmentAttempt extends Document {
  userId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  answers: { questionId: string; selectedIndex: number; isCorrect: boolean }[];
  score: number; // overall percent
  correctCount: number;
  totalQuestions: number;
  competencyResults: ICompetencyResult[];
  timeTakenSeconds: number;
  completedAt: Date;
  createdAt: Date;
}

const attemptSchema = new Schema<IAssessmentAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    answers: [
      {
        questionId: { type: String, required: true },
        selectedIndex: { type: Number, required: true, min: -1, max: 3 },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    score: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    competencyResults: [
      {
        competencyId: { type: Schema.Types.ObjectId, ref: 'Competency' },
        competencyCode: { type: String },
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        scorePercent: { type: Number, default: 0 },
        previousScore: { type: Number },
        newScore: { type: Number },
      },
    ],
    timeTakenSeconds: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attemptSchema.index({ userId: 1, completedAt: -1 });

export const AssessmentAttempt: Model<IAssessmentAttempt> = models.AssessmentAttempt || model<IAssessmentAttempt>('AssessmentAttempt', attemptSchema);
export default AssessmentAttempt;
