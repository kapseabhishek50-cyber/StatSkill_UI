import { AIProvider, GenerateOptions } from './AIProvider';
import { logger } from '../../utils/logger';

const log = logger;

/**
 * Deterministic mock LLM. Keeps the whole platform functional with zero API
 * keys (prompt §42): AI features degrade to template-generated, grounded
 * content instead of failing. Prompts embed a CONTEXT_JSON block which the
 * mock parses to produce its output — it never invents external facts.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'deterministic-mock';

  generateText(prompt: string, _options?: GenerateOptions): Promise<string> {
    const ctx = this.extractContext(prompt);
    if (ctx?.assistant) {
      return Promise.resolve(this.assistantReply(ctx));
    }
    return Promise.resolve(this.genericText(ctx));
  }

  generateJSON<T>(prompt: string, schemaName: string, _options?: GenerateOptions): Promise<T> {
    const ctx = this.extractContext(prompt);
    let output: unknown;
    switch (schemaName) {
      case 'quiz_questions':
        output = this.quizQuestions(ctx);
        break;
      case 'assessment_questions':
        output = this.quizQuestions(ctx, 'a');
        break;
      case 'recommendation_explanations':
        output = this.recommendationExplanations(ctx);
        break;
      case 'study_plan':
        output = this.studyPlan(ctx);
        break;
      default:
        output = this.genericJSON(ctx);
    }
    return Promise.resolve(output as T);
  }

  // ---------- context parsing ----------

  private extractContext(prompt: string): Record<string, unknown> | null {
    const marker = 'CONTEXT_JSON:';
    const idx = prompt.lastIndexOf(marker);
    if (idx === -1) return null;
    try {
      return JSON.parse(prompt.slice(idx + marker.length).trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ---------- generators ----------

  private quizQuestions(ctx: Record<string, unknown> | null, prefix = 'q'): unknown {
    const topic = String(ctx?.topic ?? 'General');
    const competencyCode = String(ctx?.competencyCode ?? ctx?.competency ?? 'GENERAL');
    const facts = Array.isArray(ctx?.facts) ? (ctx!.facts as string[]) : [];
    const count = Number(ctx?.count ?? 5);
    const questions: unknown[] = [];
    const banks: Record<string, [string, string[], number, string][]> = {
      default: [
        [
          `Which statement best describes a core concept of ${topic}?`,
          [`${topic} relies on systematically defined procedures`, `${topic} has no formal definition`, `${topic} excludes quality checks`, `${topic} avoids documentation`],
          0,
          `The formal definition of ${topic} emphasises systematic procedures and quality.`,
        ],
        [
          `In the context of ${topic}, which practice improves reliability of results?`,
          [`Following documented, repeatable procedures for ${topic}`, `Changing methods for every run`, `Skipping peer review of outputs`, `Ignoring metadata and definitions`],
          0,
          `Repeatable, documented procedures are a cornerstone of ${topic}.`,
        ],
        [
          `Which is the best first step when applying ${topic} to official statistics work?`,
          [`Clarify the objective and required definitions for ${topic}`, `Deploy a model without data checks`, `Publish results without validation`, `Remove all documentation`],
          0,
          `Scoping objectives and definitions precedes any ${topic} application.`,
        ],
        [
          `Which quality dimension matters most when producing outputs with ${topic}?`,
          [`Accuracy, comparability and transparency of the ${topic} pipeline`, `Speed above all other concerns`, `Complexity of tooling`, `Confidentiality of the method only`],
          0,
          `Official statistics quality frameworks prioritise accuracy, comparability and transparency.`,
        ],
      ],
    };
    const factStems = [
      (f: string) => `Based on the study material, which statement about "${f.slice(0, 90)}" is accurate?`,
      (f: string) => `Which interpretation aligns with the material's statement: "${f.slice(0, 90)}"?`,
      (f: string) => `According to the reference material, what follows from "${f.slice(0, 90)}"?`,
      (f: string) => `The study material indicates that "${f.slice(0, 90)}" — which option reflects this correctly?`,
    ];
    for (let i = 0; i < count; i++) {
      const fact = facts[i % Math.max(1, facts.length)];
      const base = banks.default[i % banks.default.length];
      questions.push({
        question: fact
          ? factStems[(i + Math.max(1, facts.length) - 1) % factStems.length](fact)
          : base[0],
        options: i % 2 === 0 || !fact ? base[1] : [
          `The material presents this as a standard practice in ${topic}`,
          `The material rejects this approach entirely`,
          `The material treats this as irrelevant to ${competencyCode}`,
          `The material lists it only as a deprecated method`,
        ],
        correctAnswer: 0,
        explanation: fact
          ? `Reference material states: "${fact.slice(0, 200)}".`
          : base[3],
        topic,
        difficulty: i === 0 ? 'easy' : i < 3 ? 'medium' : 'hard',
      });
      void prefix;
    }
    return { questions };
  }

  private recommendationExplanations(ctx: Record<string, unknown> | null): unknown {
    const courses = Array.isArray(ctx?.courses) ? (ctx!.courses as Record<string, unknown>[]) : [];
    const explanations = courses.map((c) => {
      const skill = String(c.skill ?? 'your target skill');
      const gap = Number(c.gap ?? 0);
      const role = String(c.role ?? 'your role');
      return {
        courseId: String(c.courseId),
        reason: `Your ${skill} competency is ${Number(c.current ?? 0)}% while your role requires ${Number(c.required ?? 0)}% (gap: ${gap} points). This course directly targets that gap.`,
        improvesSkill: skill,
        roleRelevance: `The skills taught are part of the ${role} competency profile.`,
        outcome: `After completing this ${String(c.level ?? '').toLowerCase()} course you should move measurably closer to the required ${Number(c.required ?? 0)}% level in ${skill}.`,
        sequenceNote: c.sequence ? String(c.sequence) : '',
      };
    });
    return { explanations };
  }

  private studyPlan(ctx: Record<string, unknown> | null): unknown {
    const gaps = Array.isArray(ctx?.gaps) ? (ctx!.gaps as Record<string, unknown>[]) : [];
    const weeks = gaps.slice(0, 6).map((g, i) => ({
      week: i + 1,
      focus: String(g.name ?? 'skill'),
      currentScore: Number(g.current ?? 0),
      targetScore: Number(g.required ?? 0),
      suggestedActivity: `Study ${g.name} fundamentals and complete one practice quiz`,
    }));
    return { plan: weeks };
  }

  private assistantReply(ctx: Record<string, unknown>): string {
    const name = String(ctx?.name ?? 'Officer');
    const gaps = Array.isArray(ctx?.topGaps) ? (ctx!.topGaps as Record<string, unknown>[]) : [];
    const lines: string[] = [];
    lines.push(`Hello ${name}! Here is a grounded summary of your current learning picture.`);
    if (gaps.length) {
      lines.push('Your largest competency gaps right now:');
      gaps.slice(0, 3).forEach((g, i) => {
        lines.push(`${i + 1}. ${g.name}: ${g.current}% (role requires ${g.required}%) — ${g.priority} priority.`);
      });
    }
    const nextCourse = ctx.nextRecommendedCourse as Record<string, unknown> | undefined;
    if (nextCourse) {
      lines.push(`Suggested next step: "${nextCourse.title}" — ${nextCourse.reason}`);
    }
    lines.push('(Deterministic assistant mode — no AI provider key is configured, so this reply is generated from your saved data.)');
    return lines.join('\n');
  }

  private genericText(ctx: Record<string, unknown> | null): string {
    if (ctx?.summary) return String(ctx.summary);
    return 'The AI provider is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY to enable generated responses. All deterministic features (skill gaps, recommendations, quizzes, progress) remain fully available.';
  }

  private genericJSON(ctx: Record<string, unknown> | null): Record<string, unknown> {
    return ctx ?? { note: 'mock provider response' };
  }
}
