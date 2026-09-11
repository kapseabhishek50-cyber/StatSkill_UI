import { levelLabel } from '../../config/competency.js';

/**
 * Deterministic offline provider.
 *
 * The app is fully usable with no API key: same shapes, same code paths, wording
 * assembled from templates instead of generated. Two reasons this exists rather
 * than the app simply failing without a key - a teammate can run the whole loop
 * without credentials, and a demo can be driven with zero network dependency.
 *
 * The generated questions are written to pass mcqValidator, so the mock cannot
 * quietly become the reason a validation test goes green.
 */

const QUESTION_TEMPLATES = [
  (name) => ({
    stem: `An officer working on ${name} finds that the standard procedure does not fit the situation encountered in the field. Which action is most consistent with sound practice?`,
    options: [
      { text: 'Document the deviation, apply the nearest approved method, and record it in the metadata.', isCorrect: true },
      { text: 'Apply an informal shortcut and leave it out of the record.', isCorrect: false },
      { text: 'Stop all work until written clearance arrives from headquarters.', isCorrect: false },
      { text: 'Substitute a figure taken from an unrelated survey round.', isCorrect: false },
    ],
    explanation:
      'Deviations are acceptable when they are approved and recorded; an undocumented change destroys comparability. Waiting for clearance on every field exception would halt collection, and borrowing a figure from another round misstates the reference period.',
  }),
  (name, level) => ({
    stem: `What distinguishes level ${level} performance in ${name} from the level immediately preceding it?`,
    options: [
      { text: 'The officer resolves non-routine cases without escalating each one.', isCorrect: true },
      { text: 'The officer memorises a longer list of standard definitions.', isCorrect: false },
      { text: 'The officer completes identical tasks in less clock time.', isCorrect: false },
      { text: 'The officer holds a higher pay grade for the same duties.', isCorrect: false },
    ],
    explanation:
      'The scale measures autonomy and judgement, not recall, speed, or grade. Independent handling of exceptions is what separates each level from the one under it.',
  }),
  (name) => ({
    stem: `A data quality check on a ${name} output flags an internal inconsistency shortly before a scheduled release. What should the officer do first?`,
    options: [
      { text: 'Trace the inconsistency to its source record before altering any figure.', isCorrect: true },
      { text: 'Release on schedule and issue a correction in the next cycle.', isCorrect: false },
      { text: 'Drop the affected series from the release without a note.', isCorrect: false },
      { text: 'Adjust the value so the check passes, then proceed.', isCorrect: false },
    ],
    explanation:
      'A failed check is a symptom; the cause decides the remedy. Publishing a known inconsistency, silently dropping a series, and tuning a value to satisfy a check all damage credibility more than a short delay.',
  }),
  (name) => ({
    stem: `In ${name}, why does a documented method matter as much as a correct result?`,
    options: [
      { text: 'It lets another officer reproduce the figure and audit the decisions taken.', isCorrect: true },
      { text: 'It shortens the time needed to compile the next round.', isCorrect: false },
      { text: 'It removes the need for supervisory review of the output.', isCorrect: false },
      { text: 'It allows a figure to be revised without a public note.', isCorrect: false },
    ],
    explanation:
      'Reproducibility is the working definition of quality in official statistics: an undocumented figure cannot be defended, revised, or reused, however accurate it happens to be.',
  }),
];

export const mockProvider = {
  name: 'mock',

  async answerAssistant({ question, context }) {
    const open = context.gaps?.filter((gap) => gap.gap > 0).slice(0, 3) ?? [];
    if (/course|learn|path|recommend/i.test(question)) {
      return { answer: open.length ? `Your highest-priority gaps are ${open.map((gap) => `${gap.name} (${gap.band})`).join(', ')}. Open Learning path to see the matched courses.` : 'You have no open role gaps right now.' };
    }
    if (/score|readiness|gap|level|skill/i.test(question)) {
      return { answer: `Your current role readiness is ${Math.round((context.readiness ?? 0) * 100)}%. ${open[0] ? `${open[0].name} is your largest open gap: level ${open[0].currentLevel} versus ${open[0].requiredLevel} required.` : 'Your recorded levels meet your role requirements.'}` };
    }
    return { answer: 'I can explain your current gaps, recommend learning, explain quiz evidence, or interpret your uploaded profile.' };
  },

  async generateMcqs({ competency, targetLevel, count = 4 }) {
    const questions = Array.from({ length: count }, (_, index) => {
      const template = QUESTION_TEMPLATES[index % QUESTION_TEMPLATES.length];
      return { ...template(competency.name, targetLevel), targetLevel };
    });
    return { questions, model: 'mock' };
  },

  async extractSkills({ documentText, competencyList }) {
    // The offline path still reads the uploaded text. It is deterministic, but
    // evidence, confidence, level, experience, and qualifications come from
    // the document rather than from demo constants.
    const source = String(documentText ?? '').replace(/\s+/g, ' ').trim();
    const haystack = source.toLowerCase();
    const skills = competencyList
      .map((competency) => {
        const words = competency.name
          .toLowerCase()
          .split(/[\s&/(),-]+/)
          .filter((word) => word.length > 2);
        const aliases = [...competency.name.matchAll(/\(([^)]+)\)/g)]
          .flatMap((match) => match[1].toLowerCase().split(/[\s/,&-]+/))
          .filter((word) => word.length > 0);
        const searchWords = [...new Set([...words, ...aliases])];
        const positions = searchWords.map((word) => findWordPosition(haystack, word)).filter((position) => position >= 0);
        if (!positions.length) return null;

        const position = Math.min(...positions);
        const evidence = excerpt(source, position, competency.name);
        const exact = haystack.includes(competency.name.toLowerCase());
        return {
          term: competency.name,
          evidence,
          impliedLevel: inferLevel(evidence),
          confidence: Number(Math.min(0.95, (exact ? 0.7 : 0.45) + (positions.length / searchWords.length) * 0.25).toFixed(2)),
        };
      })
      .filter(Boolean)
      .slice(0, 12)
      ;

    const yearsMatch = source.match(/(?:over\s+|more than\s+)?(\d{1,2})\s*(?:\+\s*)?years?\s+(?:of\s+)?(?:experience|service)/i)
      ?? source.match(/(\d{1,2})\s*(?:\+\s*)?years?\b/i);

    return {
      skills,
      experienceYears: yearsMatch ? Number(yearsMatch[1]) : null,
      qualifications: extractQualifications(source),
      model: 'mock',
    };
  },

  async explainPath({ user: officer, jobRole, gapRows }) {
    const top = gapRows.slice(0, 3);
    const names = top.map((row) => row.competency?.name).filter(Boolean);

    return {
      summary:
        `${officer.name}, your role as ${jobRole?.title ?? 'an officer'} requires strength in ` +
        `${names.slice(0, 2).join(' and ') || 'several competencies'}, and your current levels sit below ` +
        'what the role expects. The path below is ordered by how much each gap affects your day-to-day work, ' +
        'weighted by how central the competency is to your role, your division’s training priority, and expected future demand.',
      reasoning: top.map(
        (row) =>
          `${row.competency?.name}: at level ${row.currentLevel} against a requirement of ` +
          `${row.requiredLevel} (${levelLabel(row.requiredLevel)}), this is a ${row.band} priority for your role.`,
      ),
      model: 'mock',
    };
  },

  async quizFeedback({ competency, targetLevel, answers, scoreRatio, passed }) {
    const wrong = answers.filter((answer) => !answer.isCorrect);
    const right = answers.filter((answer) => answer.isCorrect);

    return {
      summary: passed
        ? `You cleared ${competency.name} at level ${targetLevel} with ${Math.round(scoreRatio * 100)}%. ` +
          `Your competency record has been updated to level ${targetLevel}.`
        : `You scored ${Math.round(scoreRatio * 100)}% on ${competency.name} at level ${targetLevel}, ` +
          'short of the 70% needed to record the level. Your existing level is unchanged.',
      strengths: right.slice(0, 3).map((answer) => truncate(answer.stem)),
      focusAreas: wrong.slice(0, 3).map((answer) => truncate(answer.stem)),
      nextStep: passed
        ? `Attempt level ${Math.min(5, targetLevel + 1)} in ${competency.name}, or start the next competency in your path.`
        : `Revisit the course material for ${competency.name}, then retake this quiz.`,
      model: 'mock',
    };
  },
};

function excerpt(source, position, term) {
  const previousStop = Math.max(source.lastIndexOf('.', position), source.lastIndexOf('!', position), source.lastIndexOf('?', position));
  const nextStops = ['.', '!', '?'].map((mark) => source.indexOf(mark, position + term.length)).filter((index) => index >= 0);
  const start = previousStop >= 0 ? previousStop + 1 : Math.max(0, position - 80);
  const end = nextStops.length ? Math.min(...nextStops) + 1 : Math.min(source.length, position + Math.max(term.length, 80));
  return source.slice(start, end).trim();
}

function findWordPosition(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(text);
  return match ? match.index : -1;
}

function inferLevel(evidence) {
  const text = evidence.toLowerCase();
  if (/chief|lead|led|managed|designed|architected|supervis|responsible for/.test(text)) return 4;
  if (/developed|implemented|analy[sz]ed|produced|coordinated|independent/.test(text)) return 3;
  if (/assisted|supported|trainee|basic|familiar|exposure/.test(text)) return 1;
  return 2;
}

function extractQualifications(source) {
  return [...source.matchAll(/\b(?:phd|doctorate|master(?:'s)?|m\.sc\.?|m\.a\.?|bachelor(?:'s)?|b\.sc\.?|b\.a\.?|mba|diploma|degree|certification|certificate)(?:\s+[A-Za-z][^;\n]{0,100})?/gi)]
    .map((match) => match[0].trim())
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 20);
}

function truncate(text, limit = 90) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}
