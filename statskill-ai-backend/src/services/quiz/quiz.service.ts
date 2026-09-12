import { Quiz, IQuiz, IQuizQuestion } from '../../models/Quiz';
import { QuizAttempt, IQuizAttempt } from '../../models/QuizAttempt';
import { scoreQuizAttempt, SubmittedAnswer } from './quizScoring.service';
import { validateQuestions } from './quizValidator.service';
import { recordLearningActivity } from '../learning/activity.service';
import { applyCompetencyUpdate } from '../competency/competencyUpdate.service';
import { competencyService } from '../competency/competency.service';
import { skillGapService } from '../skillGap/skillGap.service';
import { recommendationJob } from '../../jobs/recommendation.job';
import { notificationService } from '../notification/notification.service';
import { notFound, forbidden, badRequest } from '../../utils/errors';
import { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';
import { Request } from 'express';
import { audit } from '../../middleware/audit.middleware';
import { Types } from 'mongoose';
import { logger } from '../../utils/logger';

const log = logger;

export interface QuizSubmitInput {
  answers: SubmittedAnswer[];
  timeTakenSeconds?: number;
}

/** Learner-safe quiz shape: correct answers + explanations hidden. */
const sanitizeForLearner = (quiz: IQuiz) => ({
  ...quiz.toObject(),
  questions: quiz.questions.map((q) => ({
    questionId: q.questionId,
    question: q.question,
    options: q.options,
    topic: q.topic,
    difficulty: q.difficulty,
  })),
});

export const quizService = {
  async getById(id: string): Promise<IQuiz> {
    const quiz = await Quiz.findById(id);
    if (!quiz) throw notFound('Quiz not found');
    return quiz;
  },

  async listForLearner(req: Request) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = { status: 'PUBLISHED' };
    if (req.query.competencyCode) filter['questions.topic'] = new RegExp(String(req.query.competencyCode), 'i');
    const [items, total] = await Promise.all([
      Quiz.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit).select('-questions.correctAnswer -questions.explanation'),
      Quiz.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async getForLearner(id: string) {
    const quiz = await this.getById(id);
    if (quiz.status !== 'PUBLISHED') throw notFound('Quiz is not published');
    return sanitizeForLearner(quiz);
  },

  /** Submit + full server-side scoring → competency updates → recs refresh (prompt §26-27). */
  async submit(quizId: string, userId: string, input: QuizSubmitInput): Promise<{ attempt: Record<string, unknown>; competencyUpdates: { code: string; name: string; from: number; to: number }[] }> {
    const quiz = await this.getById(quizId);
    if (quiz.status !== 'PUBLISHED') throw forbidden('Quiz is not published');
    if (!Array.isArray(input.answers) || input.answers.length === 0) throw badRequest('Answers are required');

    // 1. Deterministic scoring (never trust the frontend).
    const result = scoreQuizAttempt(quiz.questions, input.answers);

    const attempt = await QuizAttempt.create({
      quizId: quiz._id,
      userId,
      answers: input.answers.map((a) => {
        const q = quiz.questions.find((qq) => qq.questionId === a.questionId);
        return {
          questionId: a.questionId,
          selectedIndex: a.selectedIndex,
          isCorrect: q ? a.selectedIndex === q.correctAnswer : false,
        };
      }),
      score: result.score,
      correctAnswers: result.correctAnswers,
      incorrectAnswers: result.incorrectAnswers,
      totalQuestions: result.totalQuestions,
      topicPerformance: result.topicPerformance,
      timeTakenSeconds: input.timeTakenSeconds ?? 0,
    });
    await Quiz.updateOne({ _id: quiz._id }, { $inc: { attemptCount: 1 } });

    // 2. Topic performance → competency mapping (deterministic).
    const competencyUpdates: { code: string; name: string; from: number; to: number }[] = [];
    const competencies = await competencyService.listTaxonomy();
    const requirements = await competencyService.getRequirementsForUser(userId);
    for (const tp of result.topicPerformance) {
      const comp = competencies.find(
        (c) =>
          c.name.toLowerCase() === tp.topic.toLowerCase() ||
          c.code.toLowerCase() === tp.topic.toLowerCase().replace(/[^a-z0-9]+/g, '_') ||
          c.keywords.some((k) => tp.topic.toLowerCase().includes(k.toLowerCase()))
      );
      if (!comp || tp.total === 0) continue;
      const before = await import('../../models/UserCompetency').then((m) =>
        m.UserCompetency.findOne({ userId, competencyId: comp._id })
      );
      const updated = await applyCompetencyUpdate({
        userId,
        competencyId: String(comp._id),
        observedScore: tp.percent,
        requiredScore: requirements.get(comp.code)?.requiredScore ?? comp.defaultRequiredScore,
        confidence: tp.correct / tp.total,
        canDecrease: false, // quizzes only improve scores
        source: 'QUIZ',
      });
      competencyUpdates.push({
        code: comp.code,
        name: comp.name,
        from: before?.currentScore ?? 0,
        to: updated.currentScore,
      });
    }

    // 3. Skill gap recalculation + recommendation refresh (prompt §27).
    await skillGapService.recalculateForUser(userId);
    recommendationJob.enqueue(userId);

    // 4. Activity + XP + achievements + notification.
    const activity = await recordLearningActivity({
      userId,
      type: 'QUIZ_COMPLETED',
      refType: 'quiz',
      refId: String(quiz._id),
      title: quiz.title,
      quizScorePercent: result.score,
      metadata: { score: result.score, quizId: String(quiz._id) },
    });
    void notificationService.push({
      userId,
      type: 'QUIZ_COMPLETED',
      title: `Quiz scored: ${result.score}%`,
      body: `You answered ${result.correctAnswers}/${result.totalQuestions} correctly on "${quiz.title}".`,
      data: { quizId: String(quiz._id), score: result.score },
    });

    return { attempt: { ...attempt.toObject(), xpAwarded: activity.xpAwarded }, competencyUpdates };
  },

  // ---------- trainer flows ----------

  async createManual(input: { title: string; description?: string; questions: IQuizQuestion[]; createdBy: string; competencyCode?: string; courseId?: string }) {
    const withIds: IQuizQuestion[] = input.questions.map((q, i) => ({
      ...q,
      questionId: q.questionId || `m${Date.now().toString(36)}${i}`,
      source: q.source ?? 'MANUAL',
    }));
    const quiz = await Quiz.create({
      title: input.title,
      description: input.description,
      questions: withIds,
      createdBy: input.createdBy,
      status: 'DRAFT',
      courseId: input.courseId,
      validationIssues: validateQuestions(withIds),
    });
    void audit(null, 'QUIZ_CREATED', 'quiz', String(quiz._id), { by: input.createdBy, questions: withIds.length });
    return quiz;
  },

  async listForTrainer(trainerId: string, req: Request) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = { createdBy: trainerId };
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    const [items, total] = await Promise.all([
      Quiz.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      Quiz.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async updateDraft(quizId: string, trainerId: string, input: { title?: string; description?: string; questions?: IQuizQuestion[]; durationMinutes?: number }) {
    const quiz = await this.getById(quizId);
    if (String(quiz.createdBy) !== trainerId) throw forbidden('You can only edit your own quizzes');
    if (quiz.status === 'PUBLISHED') throw badRequest('Unpublish (archive) before editing a published quiz');
    if (input.title) quiz.title = input.title;
    if (input.description !== undefined) quiz.description = input.description;
    if (input.durationMinutes) quiz.durationMinutes = input.durationMinutes;
    if (input.questions) {
      quiz.questions = input.questions.map((q, i) => ({
        ...q,
        questionId: q.questionId || `u${Date.now().toString(36)}${i}`,
      }));
      quiz.validationIssues = validateQuestions(quiz.questions);
    }
    await quiz.save();
    return quiz;
  },

  /** Publish only passes when validation is clean (prompt §25). */
  async publish(quizId: string, trainerId: string) {
    const quiz = await this.getById(quizId);
    if (String(quiz.createdBy) !== trainerId) throw forbidden('You can only publish your own quizzes');
    if (quiz.status === 'PUBLISHED') return quiz;
    const issues = validateQuestions(quiz.questions);
    if (issues.length) {
      throw badRequest('Quiz failed validation — fix the flagged questions first', issues);
    }
    if (!quiz.questions.length) throw badRequest('Quiz has no questions');
    quiz.status = 'PUBLISHED';
    quiz.publishedAt = new Date();
    quiz.validationIssues = [];
    await quiz.save();
    void audit(null, 'QUIZ_PUBLISHED', 'quiz', String(quiz._id), { by: trainerId });

    if (String(process.env.NOTIFY_QUIZ_PUBLISHED ?? 'true') !== 'false') {
      void notificationService.notifyLearners({
        type: 'QUIZ_PUBLISHED',
        title: 'New quiz published',
        body: `"${quiz.title}" is now available — test your knowledge.`,
        data: { quizId: String(quiz._id) },
      });
    }
    return quiz;
  },

  async archive(quizId: string, trainerId: string) {
    const quiz = await this.getById(quizId);
    if (String(quiz.createdBy) !== trainerId) throw forbidden('You can only archive your own quizzes');
    quiz.status = 'ARCHIVED';
    await quiz.save();
    return quiz;
  },

  /** Review helper: quiz with explanations for its owner. */
  async review(quizId: string, userId: string) {
    const quiz = await this.getById(quizId);
    if (String(quiz.createdBy) !== userId) throw forbidden('Not your quiz');
    return { quiz, issues: validateQuestions(quiz.questions) };
  },

  async resultsForQuiz(quizId: string, trainerId: string) {
    const quiz = await this.getById(quizId);
    if (String(quiz.createdBy) !== trainerId) throw forbidden('Not your quiz');
    const attempts = await QuizAttempt.find({ quizId }).populate('userId', 'name email department designation').sort({ score: -1 });
    const avgScore = attempts.length ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length : 0;
    const topicAgg = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      for (const t of a.topicPerformance) {
        const cur = topicAgg.get(t.topic) ?? { correct: 0, total: 0 };
        cur.correct += t.correct;
        cur.total += t.total;
        topicAgg.set(t.topic, cur);
      }
    }
    return {
      quiz: { id: String(quiz._id), title: quiz.title, status: quiz.status, attemptCount: quiz.attemptCount },
      attempts,
      avgScore: Math.round(avgScore),
      topicWeaknesses: [...topicAgg.entries()]
        .map(([topic, t]) => ({ topic, percent: t.total ? Math.round((t.correct / t.total) * 100) : 0 }))
        .sort((a, b) => a.percent - b.percent),
    };
  },

  /** Trainer learner view: learners who attempted trainer quizzes. */
  async learnersForTrainer(trainerId: string) {
    const quizzes = await Quiz.find({ createdBy: trainerId }).select('_id title');
    const quizIds = quizzes.map((q) => q._id);
    const attempts = await QuizAttempt.find({ quizId: { $in: quizIds } }).populate('userId', 'name email department designation');
    const byUser = new Map<string, { user: unknown; attempts: number; avgScore: number; scores: number[] }>();
    for (const a of attempts) {
      const uid = String((a.userId as unknown as { _id: Types.ObjectId })._id ?? a.userId);
      const entry = byUser.get(uid) ?? { user: a.userId, attempts: 0, avgScore: 0, scores: [] as number[] };
      entry.attempts += 1;
      entry.scores.push(a.score);
      entry.avgScore = Math.round(entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length);
      byUser.set(uid, entry);
    }
    return [...byUser.values()].map(({ user, attempts: n, avgScore }) => ({ user, attempts: n, avgScore })).sort((a, b) => b.avgScore - a.avgScore);
  },
};
