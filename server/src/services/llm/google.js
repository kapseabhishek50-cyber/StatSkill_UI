import { env } from '../../config/env.js';

export const googleProvider = {
  name: 'google-gemini',

  async answerAssistant({ question, context }) {
    const system = [
      'You are StatSkill AI, a learning assistant for officers in the Indian official statistical system.',
      'Answer directly in 2 to 5 short paragraphs or bullets.',
      'Use only the supplied learner context for personal claims. Never invent scores, courses, roles, policies, or completed training.',
      'A quiz pass can update a competency level; course completion alone cannot.',
      'If the question is outside the supplied context, say what is known and what is not known.',
    ].join('\n');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.googleModel}:generateContent?key=${encodeURIComponent(env.googleApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: `${system}\n\nLearner context:\n${JSON.stringify(context, null, 2)}\n\nQuestion:\n${question}` }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 700 },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message ?? `Google Gemini request failed (${response.status}).`);
    const answer = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!answer) throw new Error('Google Gemini returned an empty answer.');
    return { answer, model: env.googleModel };
  },
};