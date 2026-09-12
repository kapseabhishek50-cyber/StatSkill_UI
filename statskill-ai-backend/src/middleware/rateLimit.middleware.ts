import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const minutes = (n: number) => n * 60 * 1000;

/** Cached, unauthenticated landing-page read — see the exemption on globalLimiter below. */
const PUBLIC_STATS_PATH = '/api/stats/public';

/**
 * Global API limiter. (Swap in a Redis store in multi-instance deployments.)
 *
 * `/api/stats/public` is exempt: it is a read-only, unauthenticated, cache-backed
 * marketing endpoint. A shared office or state-datacentre NAT would otherwise
 * exhaust one IP's budget from landing-page polls alone and 429 the public site.
 * Cost stays bounded because the service caches and single-flights, so traffic
 * spikes do not translate into a proportional spike in Mongo aggregations.
 */
export const globalLimiter = rateLimit({
  windowMs: minutes(env.RATE_LIMIT_GLOBAL_WINDOW_MIN),
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // req.path is relative to the mount point, so match on the full URL instead.
  skip: (req) => (req.originalUrl ?? req.url).split('?')[0] === PUBLIC_STATS_PATH,
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
