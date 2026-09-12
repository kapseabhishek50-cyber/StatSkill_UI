import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  /** Optional conversation history for short-term context. */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
});
