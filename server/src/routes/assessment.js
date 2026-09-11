import { Router } from 'express';
import { z } from 'zod';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';
import { Assessment, Competency, JobRole } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { applySelfAssessment } from '../services/assessmentScoring.js';
import { recomputeAndStore } from '../services/learningPath.js';

/**
 * Baseline self-assessment.
 *
 * A submission is stored as an Assessment document *and* written through to the
 * officer's competency record with evidence 'self_reported'. Keeping both matters:
 * the Assessment is what they said on a date, UserCompetency is what the system
 * currently holds, and a later quiz changes the second without rewriting history.
 */

const router = Router();

const submission = z.object({
  type: z.enum(['baseline', 'reassessment']).default('baseline'),
  responses: z
    .array(
      z.object({
        competency: z.string().regex(/^[a-f\d]{24}$/i, 'Not a competency id.'),
        selfLevel: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
      }),
    )
    .min(1)
    .max(60),
});

router.use(requireAuth);

/** Opens an attempt and returns the form to fill in. */
router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const role = req.user.jobRole
      ? await JobRole.findById(req.user.jobRole)
          .populate('requirements.competency', 'code name category description')
          .lean()
      : null;

    const assessment = await Assessment.create({ user: req.user._id, type: 'baseline' });

    res.status(201).json({
      assessmentId: assessment._id,
      requirements: role?.requirements ?? [],
      jobRole: role ? { _id: role._id, code: role.code, title: role.title } : null,
    });
  }),
);

router.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const parsed = submission.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Some ratings could not be read.', parsed.error.flatten().fieldErrors);
    }

    const { responses, type } = parsed.data;

    const role = req.user.jobRole
      ? await JobRole.findById(req.user.jobRole).select('requirements').lean()
      : null;
    const requiredIds = new Set(
      (role?.requirements ?? []).map((requirement) => String(requirement.competency)),
    );
    if (requiredIds.size && ![...requiredIds].every((id) => responses.some((response) => response.competency === id))) {
      throw new HttpError(400, 'Rate every competency required by your role before submitting.');
    }

    // Two ratings for the same competency in one payload would race each other
    // through recordLevel; the last one submitted is the officer's answer.
    const deduped = [...new Map(responses.map((r) => [r.competency, r])).values()];
    const competencyIds = deduped.map((response) => response.competency);
    const knownCompetencies = await Competency.countDocuments({ _id: { $in: competencyIds } });
    if (knownCompetencies !== new Set(competencyIds).size) {
      throw new HttpError(400, 'One or more competency ratings are invalid.');
    }

    const outcomes = await applySelfAssessment({ user: req.user._id, responses: deduped });

    const assessmentResponses = deduped.map((response) => ({
      competency: response.competency,
      selfLevel: response.selfLevel,
      resolvedLevel: outcomes.find((o) => o.competency === response.competency)?.resolvedLevel,
    }));
    const openAssessment = await Assessment.findOneAndUpdate(
      { user: req.user._id, status: 'in_progress' },
      { $set: { type, status: 'submitted', submittedAt: new Date(), responses: assessmentResponses } },
      { new: true, sort: { startedAt: -1 } },
    );
    if (!openAssessment) {
      await Assessment.create({
        user: req.user._id,
        type,
        status: 'submitted',
        submittedAt: new Date(),
        responses: assessmentResponses,
      });
    }

    // The path is recomputed here, not on next read, so the officer sees the
    // effect of what they just submitted rather than a stale ranking.
    const path = await recomputeAndStore(req.user._id);

    res.status(201).json({
      outcomes,
      changed: outcomes.filter((outcome) => outcome.changed).length,
      readiness: path?.readiness ?? null,
    });
  }),
);

/** Past submissions, so an officer can see what they claimed and when. */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const assessments = await Assessment.find({ user: req.user._id })
      .populate('responses.competency', 'code name category')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ assessments });
  }),
);

export default router;
