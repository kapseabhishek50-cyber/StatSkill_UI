import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

/**
 * The baseline (or periodic re-)assessment. Self-rating plus a short
 * knowledge check per competency; the two are combined in
 * services/assessmentScoring.js to seed UserCompetency.
 */
const assessmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['baseline', 'reassessment'], default: 'baseline' },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress', index: true },

    responses: [
      {
        _id: false,
        competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true },
        selfLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true },
        // Optional knowledge-check result for the same competency, 0..1.
        checkRatio: { type: Number, min: 0, max: 1 },
        // Level actually written to UserCompetency after combining the two.
        resolvedLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL },
      },
    ],

    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: true, collection: 'assessments' },
);

export const Assessment = mongoose.model('Assessment', assessmentSchema);
