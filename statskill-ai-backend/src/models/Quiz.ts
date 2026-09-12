import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface IQuizQuestion {
  questionId: string;
  question: string;
  options: string[]; // exactly 4
  correctAnswer: number; // exactly one, index 0-3 — never sent to learners before submission
  explanation?: string;
  topic: string;
  competencyId?: Types.ObjectId;
  difficulty: QuestionDifficulty;
  source: 'MANUAL' | 'AI' | 'BANK';
}

export interface IQuiz extends Document {
  title: string;
  description?: string;
  materialId?: Types.ObjectId;
  courseId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: QuizStatus;
  questions: IQuizQuestion[];
  durationMinutes?: number;
  publishedAt?: Date;
  validationIssues?: unknown[];
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuizQuestion>(
  {
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String },
    topic: { type: String, required: true },
    competencyId: { type: Schema.Types.ObjectId, ref: 'Competency' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    source: { type: String, enum: ['MANUAL', 'AI', 'BANK'], default: 'AI' },
  },
  { _id: false }
);

const quizSchema = new Schema<IQuiz>(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String },
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true },
    questions: { type: [questionSchema], default: [] },
    durationMinutes: { type: Number },
    publishedAt: { type: Date },
    validationIssues: { type: [Schema.Types.Mixed], default: [] },
    attemptCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const Quiz: Model<IQuiz> = models.Quiz || model<IQuiz>('Quiz', quizSchema);
export default Quiz;
