import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { communityService } from '../services/community/community.service';

export const communityController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await communityService.list(req);
    sendSuccess(res, result, 'Communities');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const community = await communityService.create(req.body, req.user!.id);
    sendSuccess(res, { community }, 'Community created', 201);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const community = await communityService.getById(req.params.id);
    const isMember = req.user ? await communityService.isMember(req.params.id, req.user.id) : false;
    sendSuccess(res, { community: { ...community.toObject(), isMember } }, 'Community');
  }),

  join: asyncHandler(async (req: Request, res: Response) => {
    const community = await communityService.join(req.params.id, req.user!.id);
    sendSuccess(res, { community }, 'Joined community');
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    const community = await communityService.leave(req.params.id, req.user!.id);
    sendSuccess(res, { community }, 'Left community');
  }),

  members: asyncHandler(async (req: Request, res: Response) => {
    const members = await communityService.members(req.params.id);
    sendSuccess(res, { members }, 'Community members');
  }),

  messages: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const messages = await communityService.listMessages(req.params.id, req.user!.id, limit);
    sendSuccess(res, { messages }, 'Community messages');
  }),

  send: asyncHandler(async (req: Request, res: Response) => {
    const message = await communityService.sendMessage(req.params.id, req.user!.id, req.body.content, req.body.replyToId);
    sendSuccess(res, { message }, 'Message sent', 201);
  }),

  /**
   * POST /api/communities/:id/ask-ai — grounded AI answer posted into the
   * thread. Persisted with an explicit AI prefix (never attributed to a human).
   */
  askAi: asyncHandler(async (req: Request, res: Response) => {
    const { aiService } = await import('../services/ai/ai.service');
    const community = await communityService.getById(req.params.id);
    const { reply, provider, fallback } = await aiService.chat(
      req.user!.id,
      `In the "${community.name}" learning community (${community.description ?? 'no description'}), a member asks: ${req.body.prompt}`
    );
    const prompt = String(req.body.prompt).slice(0, 140);
    const message = await communityService.sendMessage(
      req.params.id,
      req.user!.id,
      `🤖 AI Co-pilot — asked: "${prompt}"\n\n${reply}`
    );
    const plain = message.toObject();
    sendSuccess(res, { message: { ...plain, isAiGenerated: true, provider, fallback } }, 'AI answer posted', 201);
  }),

  deleteMessage: asyncHandler(async (req: Request, res: Response) => {
    await communityService.deleteMessage(req.params.id, req.params.messageId, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, { deleted: true }, 'Message deleted');
  }),

  reportMessage: asyncHandler(async (req: Request, res: Response) => {
    const message = await communityService.reportMessage(req.params.id, req.params.messageId, req.user!.id, req.body.reason);
    sendSuccess(res, { message: { id: message._id, reportCount: message.reportCount, autoHidden: message.autoHidden } }, 'Message reported');
  }),
};
