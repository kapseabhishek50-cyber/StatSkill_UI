/**
 * Deterministic validation for generated MCQs.
 *
 * Every question - LLM-authored or imported - passes through here before it is
 * stored as servable. This is the layer that stops the demo-day failure where a
 * generated item has two correct answers, or gives the answer away in the stem.
 * None of these checks need a model; they are all mechanical, which is exactly
 * why they are trustworthy.
 */

const MIN_OPTIONS = 3;
const MAX_OPTIONS = 6;
const MIN_STEM_CHARS = 20;
const MIN_OPTION_CHARS = 1;

/** Words that make an option a giveaway or a throwaway. */
const LAZY_OPTIONS = ['all of the above', 'none of the above', 'both a and b', 'not applicable'];

function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard similarity over word sets - catches near-duplicate distractors. */
function similarity(a, b) {
  const setA = new Set(normalise(a).split(' ').filter(Boolean));
  const setB = new Set(normalise(b).split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / new Set([...setA, ...setB]).size;
}

/**
 * Longest run of consecutive words shared by two strings, in words.
 *
 * A leak rarely reproduces the whole option: the generator writes "Which of these
 * reduces the sampling variance..." and drops the option's leading pronoun, so a
 * plain substring test misses it. Matching on the longest shared run catches the
 * paraphrase-by-truncation case that a verbatim check does not.
 */
function longestSharedRun(a, b) {
  const left = normalise(a).split(' ').filter(Boolean);
  const right = normalise(b).split(' ').filter(Boolean);
  if (!left.length || !right.length) return [];

  let best = [];
  // Rolling previous row keeps this O(n*m) time and O(m) space.
  let previous = new Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] !== right[j - 1]) continue;
      current[j] = previous[j - 1] + 1;
      if (current[j] > best.length) best = left.slice(i - current[j], i);
    }
    previous = current;
  }

  return best;
}

const MIN_LEAK_RUN = 6;

/**
 * @param {object} question  { stem, options: [{text, isCorrect}], explanation }
 * @returns {{passed: boolean, issues: string[]}}
 */
export function validateQuestion(question) {
  const issues = [];
  const stem = String(question?.stem ?? '').trim();
  const options = Array.isArray(question?.options) ? question.options : [];

  if (stem.length < MIN_STEM_CHARS) {
    issues.push(`Stem is too short (${stem.length} chars, minimum ${MIN_STEM_CHARS}).`);
  }
  if (/\b(above|below|following figure|as shown)\b/i.test(stem) && !question.hasAttachment) {
    issues.push('Stem refers to material that is not present in the question.');
  }

  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    issues.push(`Expected ${MIN_OPTIONS}-${MAX_OPTIONS} options, got ${options.length}.`);
  }

  const correct = options.filter((option) => option?.isCorrect);
  if (correct.length !== 1) {
    issues.push(`Exactly one option must be correct, found ${correct.length}.`);
  }

  options.forEach((option, index) => {
    const text = String(option?.text ?? '').trim();
    if (text.length < MIN_OPTION_CHARS) issues.push(`Option ${index + 1} is empty.`);
    if (LAZY_OPTIONS.includes(normalise(text))) {
      issues.push(`Option ${index + 1} ("${text}") is a filler option.`);
    }
  });

  // Near-duplicate options: two options a reader cannot choose between.
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      const score = similarity(options[i]?.text, options[j]?.text);
      if (score >= 0.85) {
        issues.push(`Options ${i + 1} and ${j + 1} are near-duplicates (similarity ${score.toFixed(2)}).`);
      }
    }
  }

  // Answer leakage: the correct option, whole or in a long run, sitting in the stem.
  if (correct.length === 1) {
    const answer = normalise(correct[0].text);
    const run = longestSharedRun(stem, correct[0].text);
    // A long run of glue words ("of the overall") is not a leak, so require the
    // run to carry at least one substantive word.
    const substantive = run.some((word) => word.length > 5);

    if (
      (answer.length >= 12 && normalise(stem).includes(answer)) ||
      (run.length >= MIN_LEAK_RUN && substantive)
    ) {
      issues.push('The correct option appears verbatim in the stem.');
    }

    // Length tell: an answer far longer than every distractor is guessable
    // without knowing the subject.
    const answerLength = String(correct[0].text).length;
    const distractorMax = Math.max(
      0,
      ...options.filter((o) => !o.isCorrect).map((o) => String(o.text ?? '').length),
    );
    if (distractorMax > 0 && answerLength > distractorMax * 2.5) {
      issues.push('The correct option is much longer than every distractor (length gives it away).');
    }
  }

  if (!String(question?.explanation ?? '').trim()) {
    issues.push('Explanation is missing - a learner needs to know why the answer is right.');
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Validates a batch and splits it. Callers store `accepted` as servable and
 * `rejected` for review, so a bad generation is visible rather than silent.
 */
export function validateBatch(questions) {
  const accepted = [];
  const rejected = [];

  for (const question of questions) {
    const result = validateQuestion(question);
    const stamped = { ...question, validation: { ...result, checkedAt: new Date() } };
    (result.passed ? accepted : rejected).push(stamped);
  }

  return { accepted, rejected };
}
