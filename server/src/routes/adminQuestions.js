import { Router } from 'express';
import { z } from 'zod';
import { Question } from '../models/index.js';
import { Competency } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { generateMcqs } from '../services/llm/index.js';
import { validateBatch } from '../services/mcqValidator.js';
import { env } from '../config/env.js';

const router = Router();

router.use(requireAuth, requireRole('admin', 'trainer'));

const generationSchema = z.object({
  competency: z.string().regex(/^[a-f\d]{24}$/i),
  targetLevel: z.number().int().min(0).max(5),
  count: z.number().int().min(1).max(20).default(10),
});

router.post(
  '/generate',
  audit('admin.questions.generate'),
  asyncHandler(async (req, res) => {
    const parsed = generationSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Choose a competency, target level, and question count.');
    const competency = await Competency.findById(parsed.data.competency).lean();
    if (!competency) throw new HttpError(404, 'Competency not found.');

    const generated = await generateMcqs({ competency, targetLevel: parsed.data.targetLevel, count: parsed.data.count });
    const { accepted, rejected } = validateBatch(generated.questions.map((question) => ({ ...question, targetLevel: parsed.data.targetLevel })));
    const docs = [...accepted, ...rejected].map((question) => ({
      competency: competency._id,
      targetLevel: question.targetLevel ?? parsed.data.targetLevel,
      stem: question.stem,
      options: question.options,
      explanation: question.explanation,
      source: 'llm',
      model: generated.llmSource === 'mock' ? 'offline-template' : env.llmModel,
      validation: question.validation,
    }));
    if (docs.length) await Question.insertMany(docs, { ordered: false });
    res.status(201).json({ generated: generated.questions.length, accepted: accepted.length, rejected: rejected.length, llmSource: generated.llmSource });
  }),
);

router.get(
  '/',
  audit('admin.questions.read'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.competency) filter.competency = req.query.competency;
    if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
    if (req.query.level) filter.targetLevel = Number(req.query.level);
    if (req.query.validated) filter['validation.passed'] = req.query.validated === 'true';

    const questions = await Question.find(filter)
      .populate('competency')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      questions: questions.map((question) => ({
        ...question,
        level: question.targetLevel,
        options: question.options.map((option) => option.text),
        correctIndex: question.options.findIndex((option) => option.isCorrect),
        stats: { served: question.timesServed, correct: question.timesCorrect },
      })),
    });
  }),
);

const reviewSchema = z.object({
  reviewStatus: z.enum(['approved', 'rejected']),
});

router.patch(
  '/:id',
  audit('admin.questions.review'),
  asyncHandler(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Choose an approved or rejected status.');

    const { reviewStatus } = parsed.data;
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { reviewStatus },
      { new: true },
    );
    if (!question) {
      throw new HttpError(404, 'Question not found.');
    }
    res.json(question);
  }),
);

export default router;
