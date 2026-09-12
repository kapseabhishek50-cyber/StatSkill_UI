import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IQuizAttempt extends Document {
  quizId: Types.ObjectId;
  userId: Types.ObjectId;
  answers: { questionId: string; selectedIndex: number; isCorrect: boolean }[];
  score: number; // percent — computed server-side only (prompt §26)
  correctAnswers: number;
  incorrectAnswers: number;
  totalQuestions: number;
  topicPerformance: { topic: string; correct: number; total: number; percent: number }[];
  timeTakenSeconds: number;
  xpAwarded: number;
  submittedAt: Date;
}

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: [
      {
        questionId: { type: String, required: true },
        selectedIndex: { type: Number, required: true, min: -1, max: 3 },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    score: { type: Number, required: true, min: 0, max: 100 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    topicPerformance: [
      {
        topic: { type: String },
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        percent: { type: Number, default: 0 },
      },
    ],
    timeTakenSeconds: { type: Number, default: 0 },
    xpAwarded: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quizAttemptSchema.index({ userId: 1, submittedAt: -1 });
quizAttemptSchema.index({ quizId: 1, score: -1 });

export const QuizAttempt: Model<IQuizAttempt> = models.QuizAttempt || model<IQuizAttempt>('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
