import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type SkillGapStatus = 'OPEN' | 'IMPROVING' | 'CLOSED';

/**
 * Derived snapshot of one competency gap for one user. Recomputed
 * deterministically from UserCompetency + Role requirements — never by an LLM.
 */
export interface ISkillGap extends Document {
  userId: Types.ObjectId;
  competencyId: Types.ObjectId;
  competencyCode?: string;
  competencyName?: string;
  category?: string;
  currentScore: number;
  requiredScore: number;
  gap: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: SkillGapStatus;
  recommendedCourseIds: Types.ObjectId[];
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const skillGapSchema = new Schema<ISkillGap>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    competencyId: { type: Schema.Types.ObjectId, ref: 'Competency', required: true, index: true },
    competencyCode: { type: String, index: true },
    competencyName: { type: String },
    category: { type: String },
    currentScore: { type: Number, min: 0, max: 100 },
    requiredScore: { type: Number, min: 0, max: 100 },
    gap: { type: Number, min: 0, max: 100 },
    priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    status: { type: String, enum: ['OPEN', 'IMPROVING', 'CLOSED'], default: 'OPEN', index: true },
    recommendedCourseIds: { type: [Schema.Types.ObjectId], ref: 'Course', default: [] },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

skillGapSchema.index({ userId: 1, competencyId: 1 }, { unique: true });
skillGapSchema.index({ userId: 1, priority: 1, gap: -1 });

export const SkillGap: Model<ISkillGap> = models.SkillGap || model<ISkillGap>('SkillGap', skillGapSchema);
export default SkillGap;
