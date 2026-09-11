import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateBatch, validateQuestion } from './mcqValidator.js';

const good = {
  stem: 'In a stratified random sample, why are strata constructed to be internally homogeneous?',
  options: [
    { text: 'It reduces the sampling variance of the overall estimate.', isCorrect: true },
    { text: 'It removes the need for a sampling frame.', isCorrect: false },
    { text: 'It allows the sample size to be chosen after collection.', isCorrect: false },
    { text: 'It guarantees a response rate above 90 percent.', isCorrect: false },
  ],
  explanation:
    'Homogeneous strata mean within-stratum variance is small, so the pooled estimator has lower variance than simple random sampling of the same size.',
};

test('a well-formed question passes', () => {
  const result = validateQuestion(good);
  assert.equal(result.passed, true, result.issues.join(' | '));
});

test('two correct options fail', () => {
  const result = validateQuestion({
    ...good,
    options: good.options.map((o, i) => ({ ...o, isCorrect: i < 2 })),
  });
  assert.equal(result.passed, false);
  assert.match(result.issues.join(' '), /Exactly one option must be correct, found 2/);
});

test('no correct option fails', () => {
  const result = validateQuestion({
    ...good,
    options: good.options.map((o) => ({ ...o, isCorrect: false })),
  });
  assert.match(result.issues.join(' '), /found 0/);
});

test('answer leaking into the stem fails', () => {
  const result = validateQuestion({
    ...good,
    stem: 'Which of these reduces the sampling variance of the overall estimate in a stratified design?',
  });
  assert.equal(result.passed, false);
  assert.match(result.issues.join(' '), /verbatim in the stem/);
});

test('near-duplicate distractors fail', () => {
  const result = validateQuestion({
    ...good,
    options: [
      { text: 'It reduces the sampling variance of the overall estimate.', isCorrect: true },
      { text: 'It removes the need for a sampling frame.', isCorrect: false },
      { text: 'It removes the need for a sampling frame entirely.', isCorrect: false },
      { text: 'It guarantees a response rate above 90 percent.', isCorrect: false },
    ],
  });
  assert.equal(result.passed, false);
  assert.match(result.issues.join(' '), /near-duplicates/);
});

test('filler options fail', () => {
  const result = validateQuestion({
    ...good,
    options: [...good.options.slice(0, 3), { text: 'All of the above', isCorrect: false }],
  });
  assert.match(result.issues.join(' '), /filler option/);
});

test('a missing explanation fails', () => {
  const result = validateQuestion({ ...good, explanation: '   ' });
  assert.match(result.issues.join(' '), /Explanation is missing/);
});

test('an answer far longer than every distractor fails', () => {
  const result = validateQuestion({
    ...good,
    options: [
      {
        text: 'Because homogeneous strata reduce within-stratum variability, which in turn lowers the variance of the combined estimator relative to simple random sampling of the same total size.',
        isCorrect: true,
      },
      { text: 'No reason.', isCorrect: false },
      { text: 'Cost only.', isCorrect: false },
    ],
  });
  assert.match(result.issues.join(' '), /much longer than every distractor/);
});

test('validateBatch splits accepted from rejected and stamps both', () => {
  const { accepted, rejected } = validateBatch([good, { ...good, explanation: '' }]);
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(accepted[0].validation.passed, true);
  assert.equal(rejected[0].validation.passed, false);
  assert.ok(rejected[0].validation.checkedAt instanceof Date);
});
