import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type RecommendationStatus = 'ACTIVE' | 'DISMISSED' | 'ENROLLED' | 'EXPIRED';

export interface IRecommendationScores {
  gap: number;
  role: number;
  semantic: number;
  difficulty: number;
  history: number;
  popularity: number;
  freshness: number;
  final: number; // 0-100
}

/**
 * A persisted recommendation produced by the HYBRID engine:
 * deterministic scoring + semantic similarity + optional AI explanation
 * (which never chooses or re-ranks courses — it only explains, prompt §12/§54).
 */
export interface IRecommendation extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  competencyId?: Types.ObjectId;
  skillCode?: string;
  skillName?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  matchScore: number; // 0-100 rounded from scores.final
  scores: IRecommendationScores;
  reason: string; // AI- or deterministically-generated, grounded in provided facts
  reasonSource: 'AI' | 'DETERMINISTIC';
  explanation?: {
    improvesSkill?: string;
    roleRelevance?: string;
    outcome?: string;
    sequenceNote?: string;
  };
  status: RecommendationStatus;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scoresSchema = new Schema(
  {
    gap: { type: Number, default: 0 },
    role: { type: Number, default: 0 },
    semantic: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 },
    history: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    freshness: { type: Number, default: 0 },
    final: { type: Number, default: 0 },
  },
  { _id: false }
);

const recommendationSchema = new Schema<IRecommendation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    competencyId: { type: Schema.Types.ObjectId, ref: 'Competency' },
    skillCode: { type: String, index: true },
    skillName: { type: String },
    priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    matchScore: { type: Number, min: 0, max: 100, index: true },
    scores: { type: scoresSchema, required: true },
    reason: { type: String, default: '' },
    reasonSource: { type: String, enum: ['AI', 'DETERMINISTIC'], default: 'DETERMINISTIC' },
    explanation: {
      improvesSkill: { type: String },
      roleRelevance: { type: String },
      outcome: { type: String },
      sequenceNote: { type: String },
    },
    status: { type: String, enum: ['ACTIVE', 'DISMISSED', 'ENROLLED', 'EXPIRED'], default: 'ACTIVE', index: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

recommendationSchema.index({ userId: 1, courseId: 1 }, { unique: true });
recommendationSchema.index({ userId: 1, status: 1, matchScore: -1 });
recommendationSchema.index({ generatedAt: 1 });

export const Recommendation: Model<IRecommendation> = models.Recommendation || model<IRecommendation>('Recommendation', recommendationSchema);
export default Recommendation;
