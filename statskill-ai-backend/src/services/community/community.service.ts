import { Community, ICommunity } from '../../models/Community';
import { CommunityMember } from '../../models/CommunityMember';
import { Message, IMessage } from '../../models/Message';
import { User } from '../../models/User';
import { notificationService } from '../notification/notification.service';
import { recordLearningActivity } from '../learning/activity.service';
import { notFound, forbidden, conflict, badRequest } from '../../utils/errors';
import { parsePagination, mongoSort, buildPagination, escapeRegexSafe } from './pagination.helpers';
import { env } from '../../config/env';
import { Request } from 'express';
import { audit } from '../../middleware/audit.middleware';
import { Types } from 'mongoose';

/** Membership guard for message endpoints. */
const requireMembership = async (communityId: string, userId: string): Promise<void> => {
  const member = await CommunityMember.findOne({ communityId, userId, isActive: true });
  if (!member) throw forbidden('Join the community to participate');
};

export const communityService = {
  async list(req: Request) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) filter.name = new RegExp(escapeRegexSafe(String(req.query.q)), 'i');
    const [items, total] = await Promise.all([
      Community.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      Community.countDocuments(filter),
    ]);
    const userId = req.user?.id;
    let joinedIds = new Set<string>();
    if (userId) {
      const memberships = await CommunityMember.find({ userId, isActive: true });
      joinedIds = new Set(memberships.map((m) => String(m.communityId)));
    }
    return {
      items: items.map((c) => ({ ...c.toObject(), isMember: joinedIds.has(String(c._id)) })),
      pagination: buildPagination(total, p),
    };
  },

  async create(input: { name: string; description?: string; category: string; rules?: string }, userId: string): Promise<ICommunity> {
    const existing = await Community.findOne({ name: input.name.trim() });
    if (existing) throw conflict('A community with this name already exists');
    const community = await Community.create({ ...input, createdBy: userId });
    await CommunityMember.create({ communityId: community._id, userId, role: 'MODERATOR' });
    community.membersCount = 1;
    await community.save();
    void audit(null, 'COMMUNITY_CREATED', 'community', String(community._id), { by: userId });
    return community;
  },

  async getById(id: string) {
    const community = await Community.findById(id);
    if (!community) throw notFound('Community not found');
    return community;
  },

  async join(communityId: string, userId: string) {
    const community = await this.getById(communityId);
    const existing = await CommunityMember.findOne({ communityId, userId });
    if (existing?.isActive) throw conflict('Already a member');
    if (existing) {
      existing.isActive = true;
      await existing.save();
    } else {
      await CommunityMember.create({ communityId, userId });
    }
    community.membersCount = await CommunityMember.countDocuments({ communityId, isActive: true });
    await community.save();
    return community;
  },

  async leave(communityId: string, userId: string) {
    const community = await this.getById(communityId);
    const membership = await CommunityMember.findOne({ communityId, userId, isActive: true });
    if (!membership) throw badRequest('Not a member of this community');
    membership.isActive = false;
    await membership.save();
    community.membersCount = await CommunityMember.countDocuments({ communityId, isActive: true });
    await community.save();
    return community;
  },

  async members(communityId: string) {
    await this.getById(communityId);
    return CommunityMember.find({ communityId, isActive: true }).populate('userId', 'name designation department avatar');
  },

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const m = await CommunityMember.findOne({ communityId, userId, isActive: true });
    return Boolean(m);
  },


  /** Messages are the REST source of truth; realtime delivery rides on Firebase. */
  async listMessages(communityId: string, userId: string, limit = 50): Promise<IMessage[]> {
    await this.getById(communityId);
    await requireMembership(communityId, userId);
    return Message.find({ communityId, isDeleted: false, autoHidden: false })
      .sort({ createdAt: -1 })
      .limit(Math.min(200, limit))
      .populate('userId', 'name avatar designation');
  },

  async sendMessage(communityId: string, userId: string, content: string, replyToId?: string) {
    await this.getById(communityId);
    await requireMembership(communityId, userId);
    if (!content.trim()) throw badRequest('Message content is required');
    const message = await Message.create({ communityId, userId, content: content.trim(), replyToId });
    await recordLearningActivity({
      userId,
      type: 'DISCUSSION_PARTICIPATION',
      refType: 'community',
      refId: communityId,
      metadata: { messageId: String(message._id) },
    });
    if (replyToId) {
      const parent = await Message.findById(replyToId);
      if (parent && String(parent.userId) !== userId) {
        void notificationService.push({
          userId: String(parent.userId),
          type: 'DISCUSSION_REPLY',
          title: 'New reply to your message',
          body: content.trim().slice(0, 120),
          data: { communityId, messageId: String(message._id) },
        });
      }
    }
    return message.populate('userId', 'name avatar designation');
  },

  /** Moderation: author, moderators or admins can delete. */
  async deleteMessage(communityId: string, messageId: string, userId: string, isAdmin = false) {
    const message = await Message.findOne({ _id: messageId, communityId });
    if (!message || message.isDeleted) throw notFound('Message not found');
    const membership = await CommunityMember.findOne({ communityId, userId, isActive: true });
    const isMod = membership?.role === 'MODERATOR';
    if (!isAdmin && !isMod && String(message.userId) !== userId) throw forbidden('Not allowed to delete this message');
    message.isDeleted = true;
    message.deletedBy = new Types.ObjectId(userId);
    await message.save();
  },

  async reportMessage(communityId: string, messageId: string, userId: string, reason: string) {
    const message = await Message.findOne({ _id: messageId, communityId });
    if (!message || message.isDeleted) throw notFound('Message not found');
    if (message.reports.some((r: { userId: Types.ObjectId }) => String(r.userId) === userId)) throw conflict('Already reported');
    message.reports.push({ userId: new Types.ObjectId(userId), reason, createdAt: new Date() });
    message.reportCount = message.reports.length;
    if (message.reportCount >= env.MESSAGE_AUTO_HIDE_REPORTS) message.autoHidden = true;
    await message.save();
    return message;
  },
};
