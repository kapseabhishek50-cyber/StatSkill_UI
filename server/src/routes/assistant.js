import { Router } from 'express';
import { z } from 'zod';
import { JobRole, Profile, QuizResult } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { currentLevelMap } from '../services/assessmentScoring.js';
import { computeGaps, roleReadiness } from '../services/gapEngine.js';
import { answerAssistant } from '../services/llm/index.js';

const router = Router();
const questionSchema = z.object({ question: z.string().trim().min(2).max(500) });

router.use(requireAuth);

router.post('/', asyncHandler(async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Ask a question about your learning path.');

  const [profile, role, levels, quizHistory] = await Promise.all([
    Profile.findOne({ user: req.user._id }).lean(),
    req.user.jobRole
      ? JobRole.findById(req.user.jobRole).populate('requirements.competency').lean()
      : null,
    currentLevelMap(req.user._id),
    QuizResult.find({ user: req.user._id, status: 'submitted' })
      .populate('competency', 'name')
      .sort({ submittedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const gaps = role?.requirements?.length
    ? computeGaps({
        requirements: role.requirements,
        currentLevels: levels,
        departmentPriority: req.user.department?.priority ?? 0.5,
      })
    : [];
  const open = gaps.filter((gap) => gap.gap > 0).slice(0, 3);
  const result = await answerAssistant({
    question: parsed.data.question,
    context: {
      role: role?.title ?? null,
      department: req.user.department?.name ?? null,
      readiness: roleReadiness(gaps),
      gaps: gaps.map((gap) => ({ name: gap.competency?.name, currentLevel: gap.currentLevel, requiredLevel: gap.requiredLevel, gap: gap.gap, band: gap.band })),
      recordedCompetencies: [...levels.entries()],
      extractedSkills: profile?.extractedSkills?.map((skill) => ({ term: skill.term, evidence: skill.evidence, impliedLevel: skill.impliedLevel })) ?? [],
      recentQuizzes: quizHistory.map((quiz) => ({ competency: quiz.competency?.name, score: quiz.scoreRatio, passed: quiz.passed, levelBefore: quiz.levelBefore, levelAfter: quiz.levelAfter })),
    },
  });

  res.json({ answer: result.answer, source: result.llmSource, context: { readiness: roleReadiness(gaps), openGaps: open.length } });
}));

export default router;
