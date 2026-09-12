import { QUESTION_BANK, BankQuestion } from '../../data/questionBank';
import { Competency } from '../../models/Competency';
import { aiService } from '../ai/ai.service';
import { aiConfig } from '../../config/ai';
import { IAssessmentQuestion } from '../../models/Assessment';
import { logger } from '../../utils/logger';

const log = logger;

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export interface GenerationPlanItem {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  count: number;
}

/**
 * Assessment generation (prompt §6): static curated bank + AI-generated
 * questions. AI questions are ALWAYS validated (zod inside aiService + rules
 * here) before being shown to a learner.
 */
export const assessmentGeneratorService = {
  buildPlan(
    targetCompetencies: { _id: string; code: string; name: string }[],
    totalQuestions: number
  ): GenerationPlanItem[] {
    const per = Math.max(2, Math.floor(totalQuestions / Math.max(1, targetCompetencies.length)));
    return targetCompetencies.map((c) => ({
      competencyId: String(c._id),
      competencyCode: c.code,
      competencyName: c.name,
      count: per,
    }));
  },

  bankQuestionsFor(code: string, count: number): BankQuestion[] {
    return shuffle(QUESTION_BANK.filter((q) => q.competencyCode === code)).slice(0, count);
  },

  async generateQuestions(plan: GenerationPlanItem[]): Promise<IAssessmentQuestion[]> {
    const questions: IAssessmentQuestion[] = [];
    const seenTexts = new Set<string>();
    const stamp = Date.now().toString(36);

    for (const [pi, item] of plan.entries()) {
      // 1. Curated bank first (validated, offline-safe).
      for (const b of this.bankQuestionsFor(item.competencyCode, item.count)) {
        if (seenTexts.has(b.question.toLowerCase())) continue;
        seenTexts.add(b.question.toLowerCase());
        questions.push({
          questionId: `a${stamp}p${pi}b${questions.length}`,
          competencyId: item.competencyId as never,
          competencyCode: item.competencyCode,
          question: b.question,
          options: [...b.options],
          correctAnswer: b.correctAnswer,
          explanation: b.explanation,
          difficulty: b.difficulty,
          source: 'BANK',
        });
      }

      // 2. Top up with AI-generated questions when enabled (validated).
      const missing = item.count - this.bankQuestionsFor(item.competencyCode, item.count).length;
      if (missing > 0 && aiConfig.features.assessmentGeneration) {
        try {
          const aiQs = await aiService.generateAssessmentQuestions({
            competencyName: item.competencyName,
            competencyCode: item.competencyCode,
            count: Math.min(3, missing),
            difficulty: 'medium',
            syllabusHint: `${item.competencyName} as required for roles in India's Official Statistical System.`,
          });
          for (const q of aiQs) {
            if (questions.length >= item.count * (pi + 1)) break;
            if (seenTexts.has(q.question.toLowerCase())) continue;
            // extra rule-check beyond zod:
            if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) continue;
            seenTexts.add(q.question.toLowerCase());
            questions.push({
              questionId: `a${stamp}p${pi}ai${questions.length}`,
              competencyId: item.competencyId as never,
              competencyCode: item.competencyCode,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              difficulty: q.difficulty,
              source: 'AI',
            });
          }
        } catch (err) {
          log.warn({ err: (err as Error).message, code: item.competencyCode }, 'AI assessment questions unavailable — bank only');
        }
      }
    }
    return questions;
  },

  /** Chooses target competencies for a user: explicit list > top gaps > role defaults. */
  async resolveTargets(explicitCodes: string[] | undefined, gapCompetencyIds: { id: string; code: string; name: string }[], limit = 5) {
    if (explicitCodes?.length) {
      const comps = await Competency.find({ code: { $in: explicitCodes.map((c) => c.toUpperCase()) }, isActive: true });
      return comps.map((c) => ({ _id: String(c._id), code: c.code, name: c.name }));
    }
    return gapCompetencyIds.slice(0, limit).map((g) => ({ _id: g.id, code: g.code, name: g.name }));
  },
};
