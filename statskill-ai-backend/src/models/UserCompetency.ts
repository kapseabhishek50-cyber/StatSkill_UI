import { Schema, model, models, Model, Document, Types } from 'mongoose';
import { priorityForGap, GapPriority } from '../config/competency';

export type CompetencySource = 'ASSESSMENT' | 'QUIZ' | 'COURSE' | 'MANUAL' | 'IMPORT' | 'SEED';

export interface IUserCompetency extends Document {
  userId: Types.ObjectId;
  competencyId: Types.ObjectId;
  currentScore: number;
  requiredScore: number;
  gap: number; // requiredScore - currentScore (never below 0)
  priority: GapPriority;
  confidence: number; // 0-1
  initialScore: number; // first ever measurement (achievement tracking)
  source: CompetencySource;
  lastAssessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const computeDerived = (doc: IUserCompetency) => {
  doc.gap = Math.max(0, Math.round(doc.requiredScore - doc.currentScore));
  doc.priority = priorityForGap(doc.gap);
};

const userCompetencySchema = new Schema<IUserCompetency>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    competencyId: { type: Schema.Types.ObjectId, ref: 'Competency', required: true, index: true },
    currentScore: { type: Number, required: true, min: 0, max: 100, default: 0 },
    requiredScore: { type: Number, required: true, min: 0, max: 100, default: 60 },
    gap: { type: Number, min: 0, max: 100, default: 0 },
    priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    initialScore: { type: Number, min: 0, max: 100, default: 0 },
    source: { type: String, enum: ['ASSESSMENT', 'QUIZ', 'COURSE', 'MANUAL', 'IMPORT', 'SEED'], default: 'ASSESSMENT' },
    lastAssessedAt: { type: Date },
  },
  { timestamps: true }
);

userCompetencySchema.index({ userId: 1, competencyId: 1 }, { unique: true });
userCompetencySchema.index({ userId: 1, priority: 1, gap: -1 });

userCompetencySchema.pre('validate', function (next) {
  computeDerived(this as unknown as IUserCompetency);
  next();
});

export const UserCompetency: Model<IUserCompetency> = models.UserCompetency || model<IUserCompetency>('UserCompetency', userCompetencySchema);
export default UserCompetency;
