import mongoose from 'mongoose';

const discussionGroupSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['statistical', 'technical', 'digital_governance', 'behavioural'],
      default: 'statistical',
    },
    description: { type: String, trim: true },
    icon: { type: String, default: 'MessageSquare' },
    memberCount: { type: Number, default: 0 },
    isModerated: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'discussion_groups' },
);

const discussionMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionGroup', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, default: 'learner' },
    content: { type: String, required: true, trim: true },
    isAiGenerated: { type: Boolean, default: false, index: true },
    aiBadge: { type: String, default: 'AI Assistant' },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionMessage' },
    isPinned: { type: Boolean, default: false, index: true },
    isReported: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'discussion_messages' },
);

export const DiscussionGroup = mongoose.model('DiscussionGroup', discussionGroupSchema);
export const DiscussionMessage = mongoose.model('DiscussionMessage', discussionMessageSchema);

