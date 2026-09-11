import { Router } from 'express';
import { Recommendation } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { currentPath, recomputeAndStore } from '../services/learningPath.js';

/**
 * The learning path.
 *
 * Both routes return the same shape, so the client renders one thing whether it
 * just loaded the page or the officer pressed Recompute.
 */

const router = Router();

router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const result = await currentPath(req.user._id);
    if (!result) throw new HttpError(404, 'No profile found for this account.');
    res.json(result);
  }),
);

router.post(
  '/me/recompute',
  asyncHandler(async (req, res) => {
    const result = await recomputeAndStore(req.user._id);
    if (!result) throw new HttpError(404, 'No profile found for this account.');
    res.json(result);
  }),
);

/** Snapshot history - what was recommended, when, and on what inputs. */
router.get(
  '/me/history',
  asyncHandler(async (req, res) => {
    const history = await Recommendation.find({ user: req.user._id })
      .select('generatedAt isCurrent narrative llmSource items.competency items.priority items.band')
      .populate('items.competency', 'code name')
      .sort({ generatedAt: -1 })
      .limit(20)
      .lean();
    res.json({ history });
  }),
);

export default router;
