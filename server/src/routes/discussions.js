import { Router } from 'express';
import { z } from 'zod';
import { DiscussionGroup, DiscussionMessage } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { recordActivity, XP_REWARDS } from '../services/streakService.js';
import { aiService } from '../services/aiService.js';

const router = Router();
router.use(requireAuth);

/**
 * List all learning discussion groups.
 */
router.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const groups = await DiscussionGroup.find().sort({ memberCount: -1, title: 1 }).lean();
    res.json({ groups });
  }),
);

/**
 * Fetch messages for a specific group.
 */
router.get(
  '/groups/:id/messages',
  asyncHandler(async (req, res) => {
    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) throw new HttpError(404, 'Discussion group not found.');

    const messages = await DiscussionMessage.find({ group: group._id })
      .sort({ isPinned: -1, createdAt: 1 })
      .limit(100)
      .lean();

    res.json({ group, messages });
  }),
);

/**
 * Post a message to a discussion group. Awards gamification XP!
 */
router.post(
  '/groups/:id/messages',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      content: z.string().trim().min(2, 'Message cannot be empty.').max(1000),
      replyTo: z.string().optional(),
    });

    const parsed = schema.parse(req.body);
    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) throw new HttpError(404, 'Discussion group not found.');

    const message = await DiscussionMessage.create({
      group: group._id,
      user: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      content: parsed.content,
      replyTo: parsed.replyTo || null,
    });

    // Meaningful contribution awards XP and updates daily streak
    await recordActivity(req.user._id, {
      activityType: 'discussion_contributed',
      detail: `Contributed to ${group.title}`,
      xp: XP_REWARDS.DISCUSSION_CONTRIBUTION,
      minutes: 10,
    });

    res.status(201).json({ message });
  }),
);

/**
 * "Ask AI" inside a group: generates contextually grounded statistical guidance.
 */
router.post(
  '/groups/:id/ask-ai',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      prompt: z.string().trim().min(3),
    });

    const parsed = schema.parse(req.body);
    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) throw new HttpError(404, 'Discussion group not found.');

    // Invoke statistical AI assistant
    const assistantResult = await aiService.chatWithAssistant({
      question: `In the context of ${group.title} (${group.topic}): ${parsed.prompt}`,
      context: {
        discussionGroup: group.title,
        topic: group.topic,
        category: group.category,
      },
    });

    // Post the response into the group chat marked as AI-generated
    const aiMessage = await DiscussionMessage.create({
      group: group._id,
      user: null,
      authorName: 'StatSkill AI Co-pilot',
      authorRole: 'system',
      content: assistantResult.answer,
      isAiGenerated: true,
      aiBadge: 'AI Assistant',
    });

    res.status(201).json({ message: aiMessage });
  }),
);

/**
 * Pin or unpin a message (moderator / trainer / admin).
 */
router.patch(
  '/messages/:id/pin',
  asyncHandler(async (req, res) => {
    const msg = await DiscussionMessage.findById(req.params.id);
    if (!msg) throw new HttpError(404, 'Message not found.');

    msg.isPinned = !msg.isPinned;
    await msg.save();

    res.json({ message: msg });
  }),
);

export default router;

