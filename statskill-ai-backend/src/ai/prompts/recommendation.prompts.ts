import { priorityLabel } from './helpers';

/** Explanation prompt (prompt §12): AI explains — it NEVER selects or re-ranks. */
export const recommendationExplanationPrompt = (courses: Record<string, unknown>[], user: Record<string, unknown>): string => `You are the explanation engine of a competency-based learning platform for India's Official Statistical System.

Ranked course candidates are supplied below with their scores and the learner's factual data. For EACH course write a short grounded explanation. You MUST:
- Only use facts from the supplied data. Never invent course IDs, titles, URLs, providers, scores or availability.
- Explain WHY the course is recommended (competency gap numbers), WHAT skill it improves, HOW it relates to the learner's role, and the EXPECTED learning outcome.
- Keep each field under 40 words, professional tone.

Return STRICT JSON: {"explanations":[{"courseId":"...","reason":"...","improvesSkill":"...","roleRelevance":"...","outcome":"...","sequenceNote":"..."}]}

LEARNER:
${JSON.stringify(user)}

RANKED CANDIDATES (deterministic engine output — final authority):
${JSON.stringify(courses)}

CONTEXT_JSON:
${JSON.stringify({ courses: courses.map((c) => ({ courseId: c.courseId, skill: c.skill, current: c.currentScore, required: c.requiredScore, gap: c.gap, role: user.designation, level: c.level, sequence: c.sequenceNote })) })}`;

export const priorityLabelName = priorityLabel;
