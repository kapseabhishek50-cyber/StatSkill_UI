import mongoose from 'mongoose';
import { COMPETENCY_CATEGORIES } from '../config/competency.js';

const competencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: COMPETENCY_CATEGORIES, required: true, index: true },

    /** NSQF reference level for the competency, where the framework defines one. */
    nsqfLevel: { type: Number, min: 1, max: 10 },

    /**
     * Expected demand over the next planning horizon, 0..1. A forward-looking
     * policy input (e.g. alternative data sources trending up), so it is stored,
     * not derived from current headcount.
     */
    futureDemand: { type: Number, min: 0, max: 1, default: 0.5 },

    /** Free-text tags used for first-pass course matching before embeddings. */
    tags: [{ type: String, trim: true, lowercase: true }],
  },
  { timestamps: true, collection: 'competencies' },
);

competencySchema.index({ name: 'text', description: 'text', tags: 'text' });

export const Competency = mongoose.model('Competency', competencySchema);
