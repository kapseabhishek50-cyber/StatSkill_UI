import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

const quizResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },

    /** Level this attempt was testing for. Passing is evidence of this level. */
    targetLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress', index: true },

    answers: [
      {
        _id: false,
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedIndex: { type: Number, default: null },
        isCorrect: Boolean,
      },
    ],

    correctCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    scoreRatio: { type: Number, min: 0, max: 1, default: 0 },
    passed: { type: Boolean, default: false },

    /** Level change this attempt caused, so the loop back to the profile is traceable. */
    levelBefore: Number,
    levelAfter: Number,

    /** Per-learner AI feedback. Generated once at submit and stored. */
    feedback: {
      summary: String,
      strengths: [String],
      focusAreas: [String],
      nextStep: String,
      llmSource: { type: String, enum: ['live', 'cache', 'mock'] },
    },

    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: true, collection: 'quiz_results' },
);

export const QuizResult = mongoose.model('QuizResult', quizResultSchema);
