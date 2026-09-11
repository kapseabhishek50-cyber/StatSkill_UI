import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mockProvider } from './mock.js';
import { validateQuestion } from '../mcqValidator.js';

/**
 * The mock exists so the app runs without an API key. That is only useful if the
 * questions it produces are the same standard as generated ones - otherwise the
 * offline path quietly becomes the reason a validation check passes. This test is
 * what keeps that honest.
 */

const competency = {
  code: 'SURVEY_DESIGN',
  name: 'Survey Design and Sampling',
  category: 'domain',
};

test('every mock question passes the validator', async () => {
  const { questions } = await mockProvider.generateMcqs({ competency, targetLevel: 3, count: 8 });

  assert.equal(questions.length, 8);

  for (const question of questions) {
    const result = validateQuestion(question);
    assert.equal(result.passed, true, `${question.stem}\n  ${result.issues.join('\n  ')}`);
  }
});

test('mock questions carry the requested target level', async () => {
  const { questions } = await mockProvider.generateMcqs({ competency, targetLevel: 4, count: 4 });
  assert.ok(questions.every((question) => question.targetLevel === 4));
});

test('skill extraction only reports competencies the text supports', async () => {
  const result = await mockProvider.extractSkills({
    documentText: 'Handled sampling frames for NSS rounds. 12 years of service.',
    competencyList: [
      { name: 'Survey Design and Sampling' },
      { name: 'National Accounts Compilation' },
    ],
  });

  assert.deepEqual(
    result.skills.map((skill) => skill.term),
    ['Survey Design and Sampling'],
  );
  assert.equal(result.experienceYears, 12);
  assert.match(result.skills[0].evidence, /sampling frames/i);
  assert.notEqual(result.skills[0].evidence, 'Term matched in the uploaded document.');
});

test('skill extraction derives levels and qualifications from document wording', async () => {
  const result = await mockProvider.extractSkills({
    documentText: 'M.Sc. Statistics. Led survey design and sampling for 8 years of service. Developed R dashboards.',
    competencyList: [{ name: 'Survey Design and Sampling' }, { name: 'Statistical Programming (R / Python)' }],
  });

  assert.equal(result.experienceYears, 8);
  assert.ok(result.skills.some((skill) => skill.impliedLevel === 4));
  assert.ok(result.skills.some((skill) => skill.impliedLevel === 3));
  assert.ok(result.qualifications.some((qualification) => /M\.Sc\. Statistics/i.test(qualification)));
});

test('quiz feedback states the outcome without softening a fail', async () => {
  const result = await mockProvider.quizFeedback({
    competency,
    targetLevel: 3,
    answers: [
      { stem: 'A question that went well', isCorrect: true },
      { stem: 'A question that did not', isCorrect: false },
    ],
    scoreRatio: 0.5,
    passed: false,
  });

  assert.match(result.summary, /50%/);
  assert.match(result.summary, /unchanged/);
  assert.equal(result.focusAreas.length, 1);
});
