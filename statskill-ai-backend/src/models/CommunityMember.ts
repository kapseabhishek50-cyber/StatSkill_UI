import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface ICommunityMember extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'MEMBER' | 'MODERATOR';
  isActive: boolean;
  joinedAt: Date;
}

const communityMemberSchema = new Schema<ICommunityMember>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['MEMBER', 'MODERATOR'], default: 'MEMBER' },
    isActive: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

communityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });

export const CommunityMember: Model<ICommunityMember> = models.CommunityMember || model<ICommunityMember>('CommunityMember', communityMemberSchema);
export default CommunityMember;
