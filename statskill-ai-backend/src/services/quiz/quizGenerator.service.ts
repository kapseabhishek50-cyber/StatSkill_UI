import { Material } from '../../models/Material';
import { MaterialChunk } from '../../models/MaterialChunk';
import { Quiz, IQuizQuestion } from '../../models/Quiz';
import { aiService } from '../ai/ai.service';
import { validateQuestions } from './quizValidator.service';
import { Competency } from '../../models/Competency';
import { notFound, badRequest, AIUnavailableError } from '../../utils/errors';
import { QUESTION_BANK } from '../../data/questionBank';
import { logger } from '../../utils/logger';

const log = logger;

export interface GenerateQuizInput {
  materialId?: string;
  topic?: string;
  competencyCode?: string;
  count?: number;
  createdBy: string;
}

/**
 * AI MCQ generation pipeline (prompt §23-24):
 *   upload → extract → chunk → embed → select chunks → AI MCQs →
 *   validate (zod + rules) → store as DRAFT (trainer reviews before publish).
 */
export const quizGeneratorService = {
  async generate(input: GenerateQuizInput): Promise<{ quiz: import('../../models/Quiz').IQuiz; rejected: number; source: 'MATERIAL' | 'BANK' }> {
    const count = Math.max(3, Math.min(20, input.count ?? 5));
    let facts: string[] = [];
    let topic = input.topic ?? 'Learning Material';
    let competencyCode = input.competencyCode?.toUpperCase();
    let materialId: string | undefined;

    if (input.materialId) {
      const material = await Material.findById(input.materialId);
      if (!material) throw notFound('Material not found');
      if (material.status !== 'READY') throw badRequest(`Material is not processed yet (status: ${material.status})`);
      materialId = String(material._id);
      if (!input.topic) topic = material.title;

      // Select the most relevant chunks (embedding similarity when available, else first chunks).
      const chunks = await MaterialChunk.find({ materialId }).sort({ index: 1 }).limit(60);
      if (!chunks.length) throw badRequest('Material has no extracted text');
      const withVec = chunks.filter((c) => c.embedding?.length);
      if (withVec.length && input.topic) {
        const provider = (await import('../../ai/embeddings/embedding.service')).getEmbeddingProvider();
        const qVec = await provider.embed(input.topic);
        const { cosineSimilarity } = await import('../../utils/math');
        withVec.sort((a, b) => cosineSimilarity(qVec, b.embedding!) - cosineSimilarity(qVec, a.embedding!));
        facts = withVec.slice(0, 8).map((c) => c.text.slice(0, 1200));
      } else {
        facts = chunks.slice(0, 8).map((c) => c.text.slice(0, 1200));
      }
    } else if (!competencyCode) {
      throw badRequest('Provide materialId, or topic + competencyCode for generation');
    }

    // Resolve competency (topic mapping → competency).
    let competencyName: string | undefined;
    if (competencyCode) {
      const comp = await Competency.findOne({ code: competencyCode });
      if (comp) competencyName = comp.name;
    } else if (facts.length) {
      const comps = await Competency.find({});
      const hay = (topic + ' ' + facts.slice(0, 3).join(' ')).toLowerCase();
      competencyCode = comps.find((c) => c.keywords.some((k) => hay.includes(k.toLowerCase())))?.code ?? 'GENERAL';
      competencyName = comps.find((c) => c.code === competencyCode)?.name;
    }

    let questions: IQuizQuestion[] = [];
    let rejected = 0;

    if (input.materialId || input.topic) {
      try {
        const aiQuestions = await aiService.generateQuizQuestions({
          topic,
          competencyCode,
          competencyName,
          count,
          facts: facts.length ? facts : [`General knowledge assessment for ${topic}.`],
          difficultyMix: 'mixed',
        });
        questions = aiQuestions.map((q, i) => ({
          questionId: `q${Date.now().toString(36)}${i}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          topic: q.topic || topic,
          difficulty: q.difficulty,
          source: 'AI' as const,
        }));
      } catch (err) {
        if (!(err instanceof AIUnavailableError)) throw err;
        log.warn({ err: (err as Error).message }, 'AI quiz generation unavailable — falling back to curated bank');
      }
    }

    // Fallback / augmentation from the curated bank (keeps platform functional without AI).
    if (questions.length < count && competencyCode) {
      const bankItems = QUESTION_BANK.filter((q) => q.competencyCode === competencyCode)
        .slice(0, count - questions.length);
      for (const b of bankItems) {
        questions.push({
          questionId: `q${Date.now().toString(36)}b${questions.length}`,
          question: b.question,
          options: [...b.options],
          correctAnswer: b.correctAnswer,
          explanation: b.explanation,
          topic: competencyName ?? competencyCode,
          difficulty: b.difficulty,
          source: 'BANK',
        });
      }
    }

    // Validate AI output (prompt §25) — reject malformed questions.
    const issues = validateQuestions(questions);
    if (issues.length) {
      const badIdx = new Set(issues.map((i) => i.index));
      rejected = badIdx.size;
      questions = questions.filter((_, i) => !badIdx.has(i));
    }

    if (!questions.length) {
      throw badRequest('Could not produce valid questions for this topic — try different material or add curated questions');
    }

    const quiz = await Quiz.create({
      title: `Quiz — ${topic}`,
      description: `Auto-generated from ${materialId ? 'uploaded material' : `topic: ${topic}`}. Trainer review required before publishing.`,
      materialId,
      createdBy: input.createdBy,
      status: 'DRAFT',
      questions,
      validationIssues: issues,
      durationMinutes: Math.max(5, questions.length * 2),
    });
    log.info({ quizId: String(quiz._id), count: questions.length, rejected }, 'quiz generated');
    return { quiz, rejected, source: materialId ? 'MATERIAL' : 'BANK' };
  },
};
