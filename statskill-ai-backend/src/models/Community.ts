import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface ICommunity extends Document {
  name: string;
  description?: string;
  category: string;
  createdBy: Types.ObjectId;
  membersCount: number;
  isActive: boolean;
  rules?: string;
  createdAt: Date;
  updatedAt: Date;
}

const communitySchema = new Schema<ICommunity>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String },
    category: { type: String, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    membersCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    rules: { type: String },
  },
  { timestamps: true }
);

communitySchema.index({ name: 'text', description: 'text' });

export const Community: Model<ICommunity> = models.Community || model<ICommunity>('Community', communitySchema);
export default Community;
