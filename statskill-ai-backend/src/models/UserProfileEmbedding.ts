import { Schema, model, models, Model, Document, Types } from 'mongoose';

/**
 * Cached semantic embedding of a learner's profile (role, gaps, interests,
 * completed courses). Refreshed only on recommendation refresh / profile
 * change — never per request (prompt §11).
 */
export interface IUserProfileEmbedding extends Document {
  userId: Types.ObjectId;
  provider: string;
  embeddingModel: string;
  dim: number;
  vector: number[];
  textHash: string;
  sourceText?: string;
  updatedAt: Date;
  createdAt: Date;
}

const userProfileEmbeddingSchema = new Schema<IUserProfileEmbedding>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    provider: { type: String, required: true },
    embeddingModel: { type: String, required: true },
    dim: { type: Number, required: true },
    vector: { type: [Number], required: true },
    textHash: { type: String, required: true },
    sourceText: { type: String },
  },
  { timestamps: true }
);

export const UserProfileEmbedding =
  models.UserProfileEmbedding ||
  model<IUserProfileEmbedding>('UserProfileEmbedding', userProfileEmbeddingSchema);
export default UserProfileEmbedding;
