import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const minutes = (n: number) => n * 60 * 1000;

/** Global API limiter. (Swap in a Redis store in multi-instance deployments.) */
export const globalLimiter = rateLimit({
  windowMs: minutes(env.RATE_LIMIT_GLOBAL_WINDOW_MIN),
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down', code: 'RATE_LIMITED', errors: [] },
});

/** Stricter limiter for credential endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: minutes(15),
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many auth attempts, please try again later', code: 'RATE_LIMITED', errors: [] },
});

/** AI endpoints are expensive — lower budget. */
export const aiLimiter = rateLimit({
  windowMs: minutes(15),
  limit: env.RATE_LIMIT_AI_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'AI request budget exceeded, please try again later', code: 'RATE_LIMITED', errors: [] },
});
