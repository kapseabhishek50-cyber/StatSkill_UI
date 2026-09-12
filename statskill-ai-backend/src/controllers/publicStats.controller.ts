import { Request, Response } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { publicStatsService } from '../services/publicStats/publicStats.service';
import { env } from '../config/env';

/**
 * Public landing-page statistics. No auth, no user data — see the service for
 * what is and is not exposed.
 */
export const publicStatsController = {
  /**
   * GET /api/stats/public
   *
   * Deliberately answers with the bare payload instead of the standard
   * `{ success, data, message }` envelope. This is the one public, cacheable
   * resource that a plain `fetch()` on the marketing site reads without an API
   * client, and the response shape is already a shipped contract with the
   * existing frontend. Everything authenticated keeps the envelope.
   */
  snapshot: asyncHandler(async (_req: Request, res: Response) => {
    const payload = await publicStatsService.snapshot();
    const ttl = Math.max(0, env.PUBLIC_STATS_CACHE_TTL_SEC);
    // Short browser cache, longer shared/CDN cache, and always serve the last
    // good payload if the origin is briefly unavailable.
    res.set('Cache-Control', ttl > 0 ? `public, max-age=${ttl}, s-maxage=${ttl * 4}, stale-while-revalidate=${ttl * 8}` : 'no-store');
    res.set('Vary', 'Accept-Encoding');
    res.json(payload);
  }),
};
