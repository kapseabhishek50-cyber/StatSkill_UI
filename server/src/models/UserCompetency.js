import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

/**
 * A learner's current level in one competency - the live half of the gap
 * calculation. Written by: baseline assessment, quiz evaluation, and admin
 * override. `evidence` records which, so an unverified self-rating is never
 * mistaken for a passed assessment.
 */
const userCompetencySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true },

    currentLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true },
    evidence: {
      type: String,
      enum: ['self_reported', 'assessment', 'quiz', 'admin_override'],
      default: 'self_reported',
    },

    /** How much to trust currentLevel, 0..1. Self-rating is discounted. */
    confidence: { type: Number, min: 0, max: 1, default: 0.4 },

    /** Append-only trail, so the competency graph over time is reconstructable. */
    history: [
      {
        _id: false,
        level: Number,
        evidence: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true, collection: 'user_competencies' },
);

userCompetencySchema.index({ user: 1, competency: 1 }, { unique: true });

export const UserCompetency = mongoose.model('UserCompetency', userCompetencySchema);
