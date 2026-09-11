import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    parentOrg: { type: String, trim: true, default: 'MoSPI' },

    /**
     * How urgently this division's capability gaps need closing this cycle,
     * 0..1. Set by the ministry's annual training plan, not computed - it is a
     * policy input to the priority score.
     */
    priority: { type: Number, min: 0, max: 1, default: 0.5 },
    headcount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'departments' },
);

export const Department = mongoose.model('Department', departmentSchema);
