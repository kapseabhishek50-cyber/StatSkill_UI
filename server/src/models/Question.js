import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

const optionSchema = new mongoose.Schema(
  { text: { type: String, required: true, trim: true }, isCorrect: { type: Boolean, default: false } },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true, index: true },
    /** Difficulty expressed on the proficiency scale, not as easy/medium/hard. */
    targetLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true, index: true },

    stem: { type: String, required: true, trim: true },
    options: { type: [optionSchema], validate: (v) => v.length >= 3 && v.length <= 6 },
    explanation: { type: String, trim: true },

    source: { type: String, enum: ['llm', 'manual', 'imported'], default: 'llm', index: true },
    model: String,

    /**
     * Result of services/mcqValidator.js. A question is only served when
     * `passed` is true, so a malformed generation can never reach a learner.
     */
    validation: {
      passed: { type: Boolean, default: false, index: true },
      issues: [String],
      checkedAt: Date,
    },

    /** Set by a human reviewer; overrides validation for edge cases. */
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

    timesServed: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'questions' },
);

/** Questions that are safe to serve: validator passed and not human-rejected. */
questionSchema.statics.servable = function servable(filter = {}) {
  return this.find({ ...filter, 'validation.passed': true, reviewStatus: { $ne: 'rejected' } });
};

export const Question = mongoose.model('Question', questionSchema);
