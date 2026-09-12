import { AIProvider, GenerateOptions } from '../../ai/providers/AIProvider';
import { GeminiProvider } from '../../ai/providers/GeminiProvider';
import { OpenAIProvider } from '../../ai/providers/OpenAIProvider';
import { MockProvider } from '../../ai/providers/MockProvider';
import { aiConfig, isLLMConfigured } from '../../config/ai';
import { AIUnavailableError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { promptService } from './prompt.service';
import { buildAssistantContext } from './aiContext.service';
import { User, IUser } from '../../models/User';
import { z } from 'zod';
import { RankedCandidate } from '../recommendation/ranking.service';
import { ICourse } from '../../models/Course';

const log = logger;

let cachedProvider: AIProvider | null = null;

/** Provider registry — the ONLY place providers are instantiated (prompt §29). */
export const getAIProvider = (): AIProvider => {
  if (cachedProvider) return cachedProvider;
  switch (aiConfig.llmProvider) {
    case 'gemini':
      if (!aiConfig.gemini.apiKey) throw new AIUnavailableError('GEMINI_API_KEY not configured');
      cachedProvider = new GeminiProvider();
      break;
    case 'openai':
      if (!aiConfig.openai.apiKey) throw new AIUnavailableError('OPENAI_API_KEY not configured');
      cachedProvider = new OpenAIProvider();
      break;
    default:
      cachedProvider = new MockProvider();
  }
  log.info(`LLM provider: ${cachedProvider.name} (${cachedProvider.model})`);
  return cachedProvider;
};

export const resetAIProviderCache = (): void => {
  cachedProvider = null;
};

export const aiStatus = () => ({
  provider: aiConfig.llmProvider,
  model: getAIProvider().model,
  configured: isLLMConfigured(),
  features: aiConfig.features,
  embeddingProvider: aiConfig.embeddingProvider,
});

/** Runs an LLM call with a graceful mock fallback (prompt §42). */
const withFallback = async <T>(fn: () => Promise<T>, fallback: () => T | Promise<T>, context: string): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      log.warn({ context, err: err.message }, 'AI call failed — using deterministic fallback');
      return await fallback();
    }
    throw err;
  }
};

// ---------- schemas ----------

const mcqQuestionSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.string().min(1)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
export const mcqListSchema = z.object({ questions: z.array(mcqQuestionSchema).min(1).max(30) });
export type McqList = z.infer<typeof mcqListSchema>;

const explanationSchema = z.object({
  courseId: z.string(),
  reason: z.string().min(1),
  improvesSkill: z.string().optional(),
  roleRelevance: z.string().optional(),
  outcome: z.string().optional(),
  sequenceNote: z.string().optional(),
});
const explanationListSchema = z.object({ explanations: z.array(explanationSchema) });

// ---------- public API ----------

export const aiService = {
  /** Chat assistant — falls back to a deterministic grounded reply. */
  async chat(userId: string, question: string): Promise<{ reply: string; provider: string; fallback: boolean; context: Record<string, unknown> }> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const context = await buildAssistantContext(user);
    const { system, prompt } = promptService.assistant(context, question);
    const options: GenerateOptions = { system, temperature: 0.5, maxOutputTokens: 1200 };

    const fallbackText = async (): Promise<string> => {
      const mock = new MockProvider();
      return mock.generateText(prompt, options);
    };

    const reply = await withFallback(
      () => getAIProvider().generateText(prompt, options),
      fallbackText,
      'assistant.chat'
    );
    const usedFallback = !isLLMConfigured();
    return { reply, provider: usedFallback ? 'mock' : getAIProvider().name, fallback: usedFallback, context };
  },

  /** AI-generated MCQs from material chunks — validated with Zod (prompt §24). */
  async generateQuizQuestions(input: {
    topic: string;
    competencyCode?: string;
    competencyName?: string;
    count: number;
    facts: string[];
    difficultyMix?: 'easy' | 'mixed' | 'hard';
  }): Promise<z.infer<typeof mcqQuestionSchema>[]> {
    const prompt = promptService.quiz({
      topic: input.topic,
      competencyCode: input.competencyCode,
      competencyName: input.competencyName,
      count: input.count,
      facts: input.facts,
      difficultyMix: input.difficultyMix,
    });
    const raw = await withFallback(
      () => getAIProvider().generateJSON<unknown>(prompt, 'quiz_questions'),
      () => new MockProvider().generateJSON<unknown>(prompt, 'quiz_questions'),
      'quiz.generate'
    );
    const parsed = mcqListSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AIUnavailableError('AI generated malformed quiz questions', parsed.error.issues);
    }
    return parsed.data.questions;
  },

  /** AI assessment questions per competency — validated with Zod before use (prompt §6). */
  async generateAssessmentQuestions(input: {
    competencyName: string;
    competencyCode: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard';
    syllabusHint: string;
  }): Promise<z.infer<typeof mcqQuestionSchema>[]> {
    const prompt = promptService.assessmentQuestions(input);
    const raw = await withFallback(
      () => getAIProvider().generateJSON<unknown>(prompt, 'assessment_questions'),
      () => new MockProvider().generateJSON<unknown>(prompt, 'assessment_questions'),
      'assessment.generate'
    );
    const parsed = mcqListSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues.length }, 'AI assessment questions rejected');
      return [];
    }
    return parsed.data.questions;
  },

  /** Grounded explanations for ALREADY-RANKED courses (prompt §12). Returns map courseId → explanation. */
  async explainRecommendations(
    user: IUser,
    ranked: RankedCandidate[],
    deterministicReason: (r: RankedCandidate) => string
  ): Promise<Map<string, { reason?: string; improvesSkill?: string; roleRelevance?: string; outcome?: string; sequenceNote?: string; source: 'AI' | 'DETERMINISTIC' }>> {
    const result = new Map<string, { reason?: string; improvesSkill?: string; roleRelevance?: string; outcome?: string; sequenceNote?: string; source: 'AI' | 'DETERMINISTIC' }>();
    if (!ranked.length) return result;

    const payload = ranked.map((r, i) => {
      const course = r.course as ICourse;
      return {
        courseId: r.courseId,
        rank: i + 1,
        title: course.title,
        provider: course.provider,
        level: course.level,
        skill: r.skillName ?? r.skillCode,
        currentScore: (r.course as { _gapInfo?: { current: number } })._gapInfo?.current,
        gapNote: r.priority,
      };
    });
    const userSummary = {
      designation: user.designation,
      department: user.department,
      experience: user.experience,
    };

    try {
      if (!isLLMConfigured()) throw new AIUnavailableError('no LLM configured');
      const prompt = promptService.recommendationExplanations(payload as unknown as Record<string, unknown>[], userSummary as unknown as Record<string, unknown>);
      const raw = await getAIProvider().generateJSON<unknown>(prompt, 'recommendation_explanations', { temperature: 0.3 });
      const parsed = explanationListSchema.safeParse(raw);
      if (!parsed.success) throw new AIUnavailableError('malformed explanations');
      const validIds = new Set(ranked.map((r) => r.courseId));
      for (const e of parsed.data.explanations) {
        // Grounding guard: the AI may never introduce course IDs we did not supply.
        if (!validIds.has(e.courseId)) continue;
        result.set(e.courseId, { ...e, source: 'AI' });
      }
    } catch {
      // Deterministic fallback for every candidate.
      for (const r of ranked) {
        result.set(r.courseId, { reason: deterministicReason(r), source: 'DETERMINISTIC' });
      }
    }
    // Fill any missing candidates deterministically.
    for (const r of ranked) {
      if (!result.has(r.courseId)) {
        result.set(r.courseId, { reason: deterministicReason(r), source: 'DETERMINISTIC' });
      }
    }
    return result;
  },

  /** Study plan from top gaps (AI narrative, deterministic data). */
  async generateStudyPlan(userId: string): Promise<{ plan: unknown; provider: string }> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const context = await buildAssistantContext(user);
    const gaps = (context.topSkillGaps as Record<string, unknown>[]) ?? [];
    const prompt = `Create a week-by-week study plan for this learner. Use ONLY the provided gaps.\nGAPS: ${JSON.stringify(gaps)}\nReturn STRICT JSON: {"plan":[{"week":1,"focus":"...","suggestedActivity":"..."}]}\n\nCONTEXT_JSON:\n${JSON.stringify({ gaps })}`;
    const raw = await withFallback(
      () => getAIProvider().generateJSON<unknown>(prompt, 'study_plan'),
      () => new MockProvider().generateJSON<unknown>(prompt, 'study_plan'),
      'study.plan'
    );
    return { plan: raw, provider: isLLMConfigured() ? getAIProvider().name : 'mock' };
  },
};

