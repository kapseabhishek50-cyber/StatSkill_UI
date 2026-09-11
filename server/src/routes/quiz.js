import { Router } from 'express';
import { z } from 'zod';
import { MAX_LEVEL, MIN_LEVEL, QUIZ_PASS_RATIO } from '../config/competency.js';
import { Competency, Question, QuizResult, UserCompetency } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { generateMcqs, quizFeedback } from '../services/llm/index.js';
import { validateBatch } from '../services/mcqValidator.js';
import { recordLevel } from '../services/assessmentScoring.js';
import { recomputeAndStore } from '../services/learningPath.js';
import { recordActivity, XP_REWARDS } from '../services/streakService.js';
import { env } from '../config/env.js';

/**
 * Quizzes: the step that turns a self-rating into an assessed level.
 *
 * Three rules hold this route together:
 *
 *  1. The answer key never leaves the server. /start strips isCorrect, /submit
 *     scores against the database. A quiz that can be scored in the browser is a
 *     quiz whose result means nothing.
 *  2. The served question set is recorded on the attempt at /start. Submitting an
 *     answer to a question that was not asked scores nothing.
 *  3. Only questions that passed mechanical validation are served, and generation
 *     happens on demand at /start - never during a demo's critical path if the
 *     bank is already warm.
 */

const router = Router();

const QUESTIONS_PER_ATTEMPT = 10;
const GENERATION_BATCH = 8;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id.');
const answerOption = z.union([
  z.number().int().min(0).max(5),
  z.string().regex(/^[0-5]$/).transform(Number),
  z.null(),
]);

const startBody = z.object({
  competency: objectId,
  targetLevel: z.coerce.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
  course: objectId.optional(),
});

const submitBody = z.object({
  attemptId: objectId,
  answers: z
    .array(
      z.object({
        question: objectId,
        // The client sends the option's index as a string; null means unanswered.
        option: answerOption,
      }),
    )
    .max(60),
});

router.use(requireAuth);

/**
 * Tops up the question bank for one competency and level.
 *
 * Generated items go through the deterministic validator before they are stored,
 * and the rejects are stored too - with their issues - so a bad batch is visible
 * to whoever reviews the bank instead of vanishing.
 */
async function topUpBank(competency, targetLevel, shortfall) {
  const { questions, llmSource } = await generateMcqs({
    competency,
    targetLevel,
    count: Math.max(shortfall, GENERATION_BATCH),
  });

  const { accepted, rejected } = validateBatch(
    questions.map((question) => ({ ...question, targetLevel })),
  );

  const toInsert = [...accepted, ...rejected].map((question) => ({
    competency: competency._id,
    targetLevel: question.targetLevel ?? targetLevel,
    stem: question.stem,
    options: question.options,
    explanation: question.explanation,
    source: 'llm',
    model: llmSource === 'mock' ? 'offline-template' : env.llmModel,
    validation: question.validation,
  }));

  if (toInsert.length) await Question.insertMany(toInsert, { ordered: false });

  return { generated: questions.length, accepted: accepted.length, rejected: rejected.length };
}

/** Fisher-Yates: an attempt should not serve the bank in insertion order. */
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const parsed = startBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Pick a competency and a level.');

    const { competency: competencyId, targetLevel, course } = parsed.data;
    const competency = await Competency.findById(competencyId).lean();
    if (!competency) throw new HttpError(404, 'Unknown competency.');

    let bank = await Question.servable({ competency: competencyId, targetLevel }).lean();
    let generation = null;

    if (bank.length < QUESTIONS_PER_ATTEMPT) {
      generation = await topUpBank(competency, targetLevel, QUESTIONS_PER_ATTEMPT - bank.length);
      bank = await Question.servable({ competency: competencyId, targetLevel }).lean();
    }

    if (!bank.length) {
      throw new HttpError(
        503,
        'No validated questions are available for this level yet. The training division has been notified.',
      );
    }

    const served = shuffle(bank).slice(0, QUESTIONS_PER_ATTEMPT);

    // The attempt records what was asked. /submit scores against this list, so a
    // client cannot substitute easier questions or replay an old set.
    const attempt = await QuizResult.create({
      user: req.user._id,
      competency: competencyId,
      course,
      targetLevel,
      status: 'in_progress',
      totalCount: served.length,
      answers: served.map((question) => ({ question: question._id, selectedIndex: null })),
    });

    res.status(201).json({
      attemptId: attempt._id,
      competency: { _id: competency._id, code: competency.code, name: competency.name },
      targetLevel,
      passRatio: QUIZ_PASS_RATIO,
      // isCorrect is dropped here. This is the only place it could leak.
      questions: served.map((question) => ({
        _id: question._id,
        stem: question.stem,
        options: question.options.map((option) => ({ text: option.text })),
      })),
      generation,
    });
  }),
);

router.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const parsed = submitBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'That submission could not be read.');

    const { attemptId, answers } = parsed.data;

    const attempt = await QuizResult.findOne({ _id: attemptId, user: req.user._id });
    if (!attempt) throw new HttpError(404, 'Attempt not found.');
    if (attempt.status === 'submitted') throw new HttpError(409, 'That attempt was already submitted.');

    const competency = await Competency.findById(attempt.competency).lean();
    const asked = attempt.answers.map((answer) => String(answer.question));
    const questions = await Question.find({ _id: { $in: asked } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    const chosenBy = new Map(answers.map((answer) => [answer.question, answer.option]));

    // Iterate the questions that were *asked*, not the ones that were answered.
    const graded = asked.map((questionId) => {
      const question = byId.get(questionId);
      const correctIndex = question?.options.findIndex((option) => option.isCorrect) ?? -1;
      const selectedIndex = chosenBy.has(questionId) ? chosenBy.get(questionId) : null;
      const isCorrect = selectedIndex !== null && selectedIndex === correctIndex;

      return {
        question: questionId,
        stem: question?.stem,
        selectedIndex,
        correctIndex,
        isCorrect,
        chosen: selectedIndex === null ? null : question?.options[selectedIndex]?.text ?? null,
        correct: question?.options[correctIndex]?.text ?? null,
        explanation: question?.explanation,
      };
    });

    const correctCount = graded.filter((row) => row.isCorrect).length;
    const scoreRatio = graded.length ? correctCount / graded.length : 0;
    const passed = scoreRatio >= QUIZ_PASS_RATIO;

    // The loop closes here: a pass writes the level it tested, with evidence
    // 'quiz', which outranks the officer's own self-rating. A fail writes nothing
    // at all - it is not evidence of a lower level, only of an unproven one.
    let levelBefore;
    let levelAfter;
    if (passed) {
      const written = await recordLevel({
        user: req.user._id,
        competency: attempt.competency,
        level: attempt.targetLevel,
        evidence: 'quiz',
        note: `Passed level ${attempt.targetLevel} quiz at ${Math.round(scoreRatio * 100)}%`,
      });
      levelBefore = written.levelBefore ?? 0;
      levelAfter = written.record?.currentLevel ?? attempt.targetLevel;
    } else {
      const held = await UserCompetency.findOne({
        user: req.user._id,
        competency: attempt.competency,
      }).lean();
      levelBefore = held?.currentLevel ?? 0;
      levelAfter = levelBefore;
    }

    const feedback = await quizFeedback({
      competency,
      targetLevel: attempt.targetLevel,
      answers: graded.map((row) => ({ stem: row.stem, isCorrect: row.isCorrect })),
      scoreRatio,
      passed,
    });

    attempt.set({
      status: 'submitted',
      submittedAt: new Date(),
      answers: graded.map((row) => ({
        question: row.question,
        selectedIndex: row.selectedIndex,
        isCorrect: row.isCorrect,
      })),
      correctCount,
      totalCount: graded.length,
      scoreRatio,
      passed,
      levelBefore,
      levelAfter,
      feedback: {
        summary: feedback.summary,
        strengths: feedback.strengths,
        focusAreas: feedback.focusAreas,
        nextStep: feedback.nextStep,
        llmSource: feedback.llmSource,
      },
    });
    await attempt.save();

    // Item statistics, so a question the bank keeps getting wrong can be found.
    await Promise.all(
      graded.map((row) =>
        Question.updateOne(
          { _id: row.question },
          { $inc: { timesServed: 1, timesCorrect: row.isCorrect ? 1 : 0 } },
        ),
      ),
    );

    // A recorded level changes the gaps, so the path is rebuilt now rather than
    // leaving the officer looking at a ranking that predates their own result.
    if (passed) await recomputeAndStore(req.user._id);

    // Gamification: award XP and update daily streak
    const earnedXp = scoreRatio >= 0.8
      ? XP_REWARDS.QUIZ_COMPLETED + XP_REWARDS.HIGH_SCORE_QUIZ
      : XP_REWARDS.QUIZ_COMPLETED;
    const gamification = await recordActivity(req.user._id, {
      activityType: 'quiz_completed',
      detail: `Completed ${competency?.name || 'Competency'} quiz (${Math.round(scoreRatio * 100)}%)`,
      xp: earnedXp,
      minutes: 15,
    });

    res.status(201).json({
      result: {
        attemptId: attempt._id,
        competency: { _id: competency?._id, name: competency?.name },
        targetLevel: attempt.targetLevel,
        correctCount,
        totalCount: graded.length,
        scoreRatio,
        passed,
        levelBefore,
        levelAfter,
        answers: graded,
        feedback: attempt.feedback,
        gamification,
      },
    });
  }),
);

/** Attempt history. Submitted attempts only - an abandoned one is not a result. */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const results = await QuizResult.find({ user: req.user._id, status: 'submitted' })
      .populate('competency', 'code name category')
      .select('-answers')
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean();
    res.json({ results });
  }),
);

export default router;