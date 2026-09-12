import { z } from 'zod';

export const createCommunitySchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(1000).optional(),
  category: z.string().min(2).max(80),
  rules: z.string().max(2000).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  replyToId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export const reportMessageSchema = z.object({
  reason: z.string().min(3).max(500),
});
