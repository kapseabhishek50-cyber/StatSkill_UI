import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { aiService, aiStatus } from '../services/ai/ai.service';
import { AIUnavailableError } from '../utils/errors';
import { User } from '../models/User';
import { unauthorized } from '../utils/errors';

export const aiController = {
  /** POST /api/ai/chat — the assistant (grounded in user context, prompt §28). */
  chat: asyncHandler(async (req: Request, res: Response) => {
    const { message, history } = req.body as { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };
    if (!req.user) throw unauthorized();
    const result = await aiService.chat(req.user.id, message);
    // History is accepted for API compatibility; per-call context keeps answers grounded.
    void history;
    sendSuccess(res, result, 'Assistant reply');
  }),

  /** GET /api/ai/status — provider + feature flags. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, aiStatus(), 'AI status');
  }),

  /** POST /api/ai/study-plan — week-by-week plan from top gaps. */
  studyPlan: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw unauthorized();
    const result = await aiService.generateStudyPlan(req.user.id);
    sendSuccess(res, result, 'Study plan');
  }),

  /** GET /api/ai/test — smoke-test the configured provider (admins/dev). */
  test: asyncHandler(async (_req: Request, res: Response) => {
    try {
      const provider = aiService && (await import('../services/ai/ai.service')).getAIProvider();
      const text = await provider.generateText('Reply with the single word: OK');
      sendSuccess(res, { provider: provider.name, model: provider.model, response: text.slice(0, 100) }, 'AI provider reachable');
    } catch (err) {
      if (err instanceof AIUnavailableError) {
        sendSuccess(res, { error: err.message, fallback: 'Deterministic mock provider remains available' }, 'AI provider unavailable');
      } else throw err;
    }
  }),
};

// keep User import used for typing helpers
void User;
