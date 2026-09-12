/** Prompts for AI MCQ generation from learning material (prompt §23-24). */

export interface QuizPromptContext {
  topic: string;
  competencyCode?: string;
  competencyName?: string;
  count: number;
  difficultyMix?: 'easy' | 'mixed' | 'hard';
  language?: 'english' | 'hindi';
  facts: string[]; // extracted material chunks — the ONLY source of truth
}

export const quizGenerationPrompt = (ctx: QuizPromptContext): string => {
  const difficulty = ctx.difficultyMix ?? 'mixed';
  return `You are an expert examination writer for India's Official Statistical System training academy.

Generate exactly ${ctx.count} multiple-choice questions to test understanding of "${ctx.topic}".
The questions MUST be answerable ONLY from the STUDY MATERIAL below — never invent facts, statistics, laws or numbers.

Rules:
- Each question has EXACTLY 4 options and EXACTLY 1 correct answer (index 0-3).
- Options must be mutually exclusive and similar in length/style.
- Include a one-to-three sentence explanation citing the underlying fact.
- Difficulty mix: ${difficulty} (easy/medium/hard).
- No duplicate questions; options within a question must be unique.
${ctx.language === 'hindi' ? '- Language: Hindi (Devanagari script) for questions, options and explanations; keep technical terms in English in parentheses.' : '- Language: clear professional English.'}

Return STRICT JSON: {"questions":[{"question":"...","options":["","","",""],"correctAnswer":0,"explanation":"...","topic":"${ctx.topic}","difficulty":"easy|medium|hard"}]}

STUDY MATERIAL (verbatim chunks):
${ctx.facts.map((f, i) => `[${i + 1}] ${f}`).join('\n\n')}

CONTEXT_JSON:
${JSON.stringify({ topic: ctx.topic, competencyCode: ctx.competencyCode, count: ctx.count, facts: ctx.facts.slice(0, 8) })}`;
};

export const assessmentQuestionsPrompt = (ctx: {
  competencyName: string;
  competencyCode: string;
  count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  syllabusHint: string;
}): string => `You are an assessment designer for India's Official Statistical System.

Write ${ctx.count} multiple-choice questions measuring practical competency in "${ctx.competencyName}" at ${ctx.difficulty} difficulty.
Scope: ${ctx.syllabusHint}

Rules:
- EXACTLY 4 options, EXACTLY 1 correct (index 0-3).
- Questions must have an objectively correct answer (no opinion).
- Explanation required.
- Unique questions; unique options.

Return STRICT JSON: {"questions":[{"question":"...","options":["","","",""],"correctAnswer":0,"explanation":"...","topic":"${ctx.competencyName}","difficulty":"${ctx.difficulty}"}]}

CONTEXT_JSON:
${JSON.stringify({ topic: ctx.competencyName, competencyCode: ctx.competencyCode, count: ctx.count, facts: [ctx.syllabusHint] })}`;
