import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { assessmentService } from '../services/assessment/assessment.service';

export const assessmentController = {
  start: asyncHandler(async (req: Request, res: Response) => {
    const result = await assessmentService.start(req.user!.id, req.body);
    sendSuccess(res, result, result.existing ? 'Assessment already in progress' : 'Assessment generated', result.existing ? 200 : 201);
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = await assessmentService.submit(req.params.id, req.user!.id, req.body);
    sendSuccess(res, result, 'Assessment submitted and scored');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const assessment = await assessmentService.getByIdForUser(req.params.id, req.user!.id);
    sendSuccess(res, { assessment: assessmentService.toLearnerView(assessment) }, 'Assessment');
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const history = await assessmentService.history(req.user!.id);
    sendSuccess(res, { history }, 'Assessment history');
  }),

  /**
   * POST /api/assessment/self — record self-reported 0-5 ratings.
   * Stored at low confidence; quiz evidence overrides them later.
   */
  selfAssess: asyncHandler(async (req: Request, res: Response) => {
    const { competencyService } = await import('../services/competency/competency.service');
    const { skillGapService } = await import('../services/skillGap/skillGap.service');
    const { recommendationJob } = await import('../jobs/recommendation.job');
    const { recordLearningActivity } = await import('../services/learning/activity.service');
    const { User } = await import('../models/User');

    const userId = req.user!.id;
    const user = await User.findById(userId);
    const requirements = await competencyService.getRequirementsForUser(userId, user?.designation);
    const byCompetencyId = new Map([...requirements.values()].map((r) => [r.competencyId, r.requiredScore]));

    const responses = (req.body.responses as { competency: string; selfLevel: number }[])
      // Ignore stale/unknown competency ids rather than recording phantom rows.
      .filter((r) => byCompetencyId.has(r.competency));
    let recorded = 0;
    for (const r of responses) {
      await competencyService.upsertScore({
        userId,
        competencyId: r.competency,
        currentScore: r.selfLevel * 20,
        requiredScore: byCompetencyId.get(r.competency) ?? 60,
        confidence: 0.35,
        source: 'SELF_REPORTED',
        assessedAt: new Date(),
      });
      recorded += 1;
    }
    await skillGapService.recalculateForUser(userId);
    recommendationJob.enqueue(userId);
    const activity = await recordLearningActivity({
      userId,
      type: 'ASSESSMENT_COMPLETED',
      refType: 'assessment',
      refId: responses[0]?.competency,
      title: 'Self-assessment',
      metadata: { recorded, mode: 'self' },
    });
    sendSuccess(res, { recorded, xpAwarded: activity.xpAwarded }, 'Self-assessment recorded');
  }),
};
