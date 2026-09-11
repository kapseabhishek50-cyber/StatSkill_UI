import mongoose from 'mongoose';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';

/**
 * One requirement row: this role needs this competency at this level.
 * This sub-document IS the competency framework - the "Required Competency"
 * term in the gap formula reads straight off it.
 */
const requirementSchema = new mongoose.Schema(
  {
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true },
    requiredLevel: { type: Number, min: MIN_LEVEL, max: MAX_LEVEL, required: true },

    /**
     * How central this competency is to the role, 0..1. A Field Investigator
     * needs data collection at importance 1.0 and national accounts at 0.2 -
     * both may show a gap, only one should dominate the learning path.
     */
    importance: { type: Number, min: 0, max: 1, default: 0.5 },

    /** Mandatory requirements are surfaced even when the computed gap is small. */
    mandatory: { type: Boolean, default: false },
  },
  { _id: false },
);

const jobRoleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    grade: { type: String, trim: true },
    description: { type: String, trim: true },
    requirements: [requirementSchema],
  },
  { timestamps: true, collection: 'job_roles' },
);

export const JobRole = mongoose.model('JobRole', jobRoleSchema);
