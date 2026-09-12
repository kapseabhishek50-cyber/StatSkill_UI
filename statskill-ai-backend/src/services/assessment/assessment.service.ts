import { Assessment, IAssessment, IAssessmentQuestion } from '../../models/Assessment';
import { AssessmentAttempt } from '../../models/AssessmentAttempt';
import { User } from '../../models/User';
import { skillGapService } from '../skillGap/skillGap.service';
import { assessmentGeneratorService } from './assessmentGenerator.service';
import { scoreAssessment, AssessmentScoreResult } from './assessmentScoring.service';
import { applyCompetencyUpdate } from '../competency/competencyUpdate.service';
import { competencyService } from '../competency/competency.service';
import { recordLearningActivity } from '../learning/activity.service';
import { recommendationJob } from '../../jobs/recommendation.job';
import { notFound, badRequest, forbidden } from '../../utils/errors';
import { SubmittedAnswer } from '../quiz/quizScoring.service';
import { audit } from '../../middleware/audit.middleware';
import { Types } from 'mongoose';

const ASSESSMENT_TTL_MINUTES = 90;

export const assessmentService = {
  /** POST /assessment/start — generates an assessment from role/gaps (prompt §6). */
  async start(userId: string, opts: { competencyCodes?: string[]; questionCount?: number; type?: string } = {}) {
    const user = await User.findById(userId);
    if (!user) throw notFound('User not found');

    // One in-flight assessment at a time.
    const inFlight = await Assessment.findOne({ userId, status: 'IN_PROGRESS', expiresAt: { $gt: new Date() } });
    if (inFlight) {
      return { assessment: this.toLearnerView(inFlight), existing: true };
    }

    const allGaps = await skillGapService.recalculateForUser(userId);
    const gaps = allGaps
      .filter((g) => g.status !== 'CLOSED' && g.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 6);
    const targets = await assessmentGeneratorService.resolveTargets(
      opts.competencyCodes,
      gaps.map((g) => ({ id: String(g.competencyId), code: String(g.competencyCode), name: g.competencyName ?? '' })),
      5
    );
    if (!targets.length) throw badRequest('No competencies available to assess — complete your profile or specify competencyCodes');

    const plan = assessmentGeneratorService.buildPlan(targets, opts.questionCount ?? 15);
    const questions = await assessmentGeneratorService.generateQuestions(plan);
    if (!questions.length) throw badRequest('Could not assemble assessment questions');

    const assessment = await Assessment.create({
      userId,
      type: opts.type ?? 'ROLE_BASED',
      status: 'IN_PROGRESS',
      competencyIds: targets.map((t) => t._id) as never,
      questions,
      config: {
        role: user.designation,
        department: user.department,
        experienceYears: user.experience,
        basedOnGaps: !opts.competencyCodes,
        generatedAt: new Date(),
      },
      expiresAt: new Date(Date.now() + ASSESSMENT_TTL_MINUTES * 60000),
    });

    return { assessment: this.toLearnerView(assessment), existing: false };
  },

  /** Learner-safe view: correct answers + explanations stripped. */
  toLearnerView(assessment: IAssessment) {
    return {
      id: String(assessment._id),
      type: assessment.type,
      status: assessment.status,
      expiresAt: assessment.expiresAt,
      config: assessment.config,
      competencyIds: assessment.competencyIds,
      questions: assessment.questions.map((q) => ({
        questionId: q.questionId,
        competencyCode: q.competencyCode,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      })),
    };
  },

  /** POST /assessment/:id/submit — scoring → competency mapping → gaps → recs. */
  async submit(assessmentId: string, userId: string, input: { answers: SubmittedAnswer[]; timeTakenSeconds?: number }) {
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) throw notFound('Assessment not found');
    if (String(assessment.userId) !== userId) throw forbidden('Not your assessment');
    if (assessment.status !== 'IN_PROGRESS') throw badRequest('Assessment already submitted or expired');
    if (assessment.expiresAt < new Date()) {
      assessment.status = 'EXPIRED';
      await assessment.save();
      throw badRequest('Assessment expired — start a new one');
    }

    // 1. Deterministic scoring.
    const result: AssessmentScoreResult = scoreAssessment(assessment, input.answers);

    // 2. Store attempt (history, prompt §6).
    const attempt = await AssessmentAttempt.create({
      userId,
      assessmentId: assessment._id,
      answers: input.answers.map((a: SubmittedAnswer) => {
        const q: IAssessmentQuestion | undefined = assessment.questions.find((qq: IAssessmentQuestion) => qq.questionId === a.questionId);
        return { questionId: a.questionId, selectedIndex: a.selectedIndex, isCorrect: q ? a.selectedIndex === q.correctAnswer : false };
      }),
      score: result.score,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      competencyResults: [],
      timeTakenSeconds: input.timeTakenSeconds ?? 0,
    });

    // 3. Competency mapping → current score (deterministic; assessments may lower scores).
    const requirements = await competencyService.getRequirementsForUser(userId);
    const competencyResults = [];
    for (const line of result.competencyResults) {
      const comp = await competencyService.getById(line.competencyId);
      if (!comp) continue;
      const before = (await import('../../models/UserCompetency')).UserCompetency.findOne({ userId, competencyId: comp._id });
      const prevScore = (await before)?.currentScore ?? 0;
      const updated = await applyCompetencyUpdate({
        userId,
        competencyId: String(comp._id),
        observedScore: line.scorePercent,
        requiredScore: requirements.get(comp.code)?.requiredScore ?? comp.defaultRequiredScore,
        confidence: line.total ? line.correct / line.total : 0.5,
        canDecrease: true,
        source: 'ASSESSMENT',
      });
      line.previousScore = prevScore;
      line.newScore = updated.currentScore;
      competencyResults.push(line);
    }
    attempt.competencyResults = competencyResults as never;
    await attempt.save();

    // 4. Assessment status.
    assessment.status = 'COMPLETED';
    assessment.completedAt = new Date();
    await assessment.save();

    // 5. Skill gaps → recommendation refresh → activity/XP/achievements.
    await skillGapService.recalculateForUser(userId);
    recommendationJob.enqueue(userId);
    const activity = await recordLearningActivity({
      userId,
      type: 'ASSESSMENT_COMPLETED',
      refType: 'assessment',
      refId: String(assessment._id),
      title: `${assessment.type} assessment`,
      metadata: { score: result.score },
    });

    void audit(null, 'ASSESSMENT_COMPLETED', 'assessment', String(assessment._id), { userId, score: result.score });

    return {
      attemptId: String(attempt._id),
      score: result.score,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      competencyResults,
      xpAwarded: activity.xpAwarded,
      newAchievements: activity.newAchievements,
    };
  },

  async history(userId: string, limit = 20) {
    return AssessmentAttempt.find({ userId }).sort({ completedAt: -1 }).limit(limit);
  },

  async getByIdForUser(assessmentId: string, userId: string) {
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) throw notFound('Assessment not found');
    if (String(assessment.userId) !== userId) throw forbidden('Not your assessment');
    return assessment;
  },
};
