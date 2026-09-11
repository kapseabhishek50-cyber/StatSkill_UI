import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['iGOT', 'NSSTA', 'internal', 'other'], required: true, index: true },
    providerCourseId: { type: String, trim: true },
    url: { type: String, trim: true },

    description: { type: String, trim: true },
    durationHours: { type: Number, min: 0, default: 0 },
    modality: { type: String, enum: ['self_paced', 'instructor_led', 'blended'], default: 'self_paced' },
    languages: [{ type: String, trim: true }],

    /**
     * What the course actually moves. `targetLevel` is the level a learner is
     * expected to reach on completion - the matcher uses it to avoid
     * recommending a level-2 primer to someone already at level 3.
     */
    competencies: [
      {
        _id: false,
        competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true },
        targetLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true },
        // Share of the course devoted to this competency, 0..1.
        weight: { type: Number, min: 0, max: 1, default: 1 },
      },
    ],

    tags: [{ type: String, trim: true, lowercase: true }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    enrolments: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'courses' },
);

courseSchema.index({ 'competencies.competency': 1 });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Course = mongoose.model('Course', courseSchema);
