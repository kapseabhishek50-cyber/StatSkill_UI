import { PROFICIENCY_LEVELS, levelLabel } from '../../config/competency.js';

/**
 * Prompt builders. Kept in one file so the wording is reviewable in a single
 * place, and split into a stable `system` half and a volatile `user` half - the
 * system half is identical across requests, which is what makes prompt caching
 * work (a byte change anywhere in the prefix invalidates the cache).
 */

const SCALE_TABLE = PROFICIENCY_LEVELS.map((l) => `${l.level} = ${l.label}: ${l.descriptor}`).join('\n');

/** Stable across every call in this app - safe to cache. */
export const SYSTEM_CONTEXT = `You support StatSkill AI, a competency-based training platform for officers of the Indian official statistical system (MoSPI, the National Statistical Office, and State Directorates of Economics and Statistics).

All proficiency is expressed on this fixed 0-5 ordinal scale:
${SCALE_TABLE}

Rules that apply to every task:
- Ground everything in official statistics practice: survey design and sampling, field operations, national accounts, price indices, data quality and validation, metadata standards, statistical disclosure control, dissemination.
- Use Indian statistical system terminology where it applies (NSS rounds, CPI/WPI, NSQF, SDG indicator framework, iGOT Karmayogi).
- Never invent a course, a circular, a scheme, or a statistic. If you do not know a specific fact, describe the concept instead of naming a source.
- Write plainly, for a working officer rather than an academic.`;

export function mcqPrompt({ competency, targetLevel, count = 5, courseTitle }) {
  const system = `${SYSTEM_CONTEXT}

TASK: write multiple-choice questions that test whether an officer genuinely holds a competency at a stated level.

Question requirements - all are checked mechanically after generation, and a question that fails any of them is discarded:
- Exactly one option is correct.
- 4 options. Every distractor must be plausible to someone who half-knows the topic, and clearly wrong to someone who knows it.
- Never write "All of the above", "None of the above", or "Both A and B".
- The correct option must not appear verbatim in the stem, and must not be conspicuously longer than the distractors.
- No question may refer to a table, figure, or passage that is not written out in the stem itself.
- Every question carries a short explanation of why the correct option is right AND why the nearest distractor is wrong.
- Test application and judgement, not recall of definitions, for level 3 and above.`;

  const user = `Competency: ${competency.name}
${competency.description ? `Definition: ${competency.description}\n` : ''}Category: ${competency.category}
Target level: ${targetLevel} (${levelLabel(targetLevel)})
${courseTitle ? `The learner has just completed: ${courseTitle}\n` : ''}
Write ${count} questions at exactly this level. A level-${targetLevel} question should be answerable by an officer at level ${targetLevel} and genuinely difficult for one at level ${Math.max(0, targetLevel - 1)}.`;

  return { system, user };
}

export function skillExtractionPrompt({ documentText, competencyList }) {
  const system = `${SYSTEM_CONTEXT}

TASK: read an officer's CV or service record and extract evidence of statistical competencies.

- Extract only what the document actually supports. An officer who "assisted in data entry for NSS 78th round" is not at level 4 in survey design.
- For each skill, quote the phrase from the document that supports it as \`evidence\`.
- \`impliedLevel\` is what the document evidences, not what the job title suggests.
- \`confidence\` reflects how directly the document supports the level: a described responsibility is high, a bare keyword in a skills list is low.
- Prefer terms from the competency list below when the document matches one.`;

  const user = `Known competencies:
${competencyList.map((c) => `- ${c.name}`).join('\n')}

Document text:
"""
${documentText}
"""`;

  return { system, user };
}

export function pathNarrativePrompt({ user: officer, jobRole, gapRows }) {
  const system = `${SYSTEM_CONTEXT}

TASK: explain a computed learning path to the officer it belongs to.

- The gap scores are already computed and are not yours to change. Explain them; do not re-rank them.
- Address the officer directly in second person. 120 words maximum for the summary.
- \`reasoning\` is one line per competency for the top gaps, each naming the concrete consequence of the gap for that officer's actual work.
- No praise, no motivational language, no restating the numbers the interface already shows.`;

  const rows = gapRows
    .slice(0, 5)
    .map(
      (row) =>
        `- ${row.competency?.name}: at level ${row.currentLevel}, role needs ${row.requiredLevel}` +
        ` (priority ${row.priority}, ${row.band}${row.mandatory ? ', mandatory' : ''})`,
    )
    .join('\n');

  const user = `Officer: ${officer.name}
Role: ${jobRole?.title ?? 'unspecified'}
Top competency gaps:
${rows}`;

  return { system, user };
}

export function quizFeedbackPrompt({ competency, targetLevel, answers, scoreRatio, passed }) {
  const system = `${SYSTEM_CONTEXT}

TASK: give an officer feedback on a completed competency quiz.

- Base every statement on the specific questions answered wrongly. Do not generalise beyond them.
- \`focusAreas\` names sub-topics, not whole competencies.
- \`nextStep\` is one concrete action: a topic to revise, or the next level to attempt.
- Do not soften a fail or inflate a pass.`;

  const detail = answers
    .map(
      (answer, index) =>
        `${index + 1}. ${answer.isCorrect ? 'CORRECT' : 'WRONG'} - ${answer.stem}` +
        (answer.isCorrect ? '' : `\n   Chose: ${answer.chosen ?? 'no answer'}\n   Correct: ${answer.correct}`),
    )
    .join('\n');

  const user = `Competency: ${competency.name}
Level attempted: ${targetLevel} (${levelLabel(targetLevel)})
Score: ${Math.round(scoreRatio * 100)}% - ${passed ? 'passed' : 'not passed'}

Responses:
${detail}`;

  return { system, user };
}
