import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeGaps,
  normalisedGap,
  priorityScore,
  roleReadiness,
} from './gapEngine.js';

test('gap is zero when the learner already meets the requirement', () => {
  assert.equal(normalisedGap(3, 3), 0);
  assert.equal(normalisedGap(3, 5), 0, 'over-qualified must clamp to 0, not go negative');
});

test('gap is normalised onto 0..1', () => {
  assert.equal(normalisedGap(5, 0), 1);
  assert.equal(normalisedGap(1, 0), 0.2);
});

test('no gap means zero priority however important the competency is', () => {
  const score = priorityScore({
    requiredLevel: 2,
    currentLevel: 4,
    roleImportance: 1,
    departmentPriority: 1,
    futureDemand: 1,
  });
  assert.equal(score, 0);
});

test('priority stays inside 0..1 and peaks at a full gap on a maximal context', () => {
  const worst = priorityScore({
    requiredLevel: 5,
    currentLevel: 0,
    roleImportance: 1,
    departmentPriority: 1,
    futureDemand: 1,
  });
  assert.equal(worst, 1);
});

test('a zero context factor does not wipe the score (the bug a product formula has)', () => {
  const score = priorityScore({
    requiredLevel: 4,
    currentLevel: 1,
    roleImportance: 1,
    departmentPriority: 0,
    futureDemand: 0,
  });
  // gap 0.6 x context (0.5*1) = 0.3 - still ranked, not silently dropped.
  assert.equal(score, 0.3);
});

test('a bigger gap on a core competency outranks a bigger gap on a peripheral one', () => {
  const core = priorityScore({
    requiredLevel: 4, currentLevel: 2, roleImportance: 1, departmentPriority: 0.5, futureDemand: 0.5,
  });
  const peripheral = priorityScore({
    requiredLevel: 5, currentLevel: 3, roleImportance: 0.1, departmentPriority: 0.5, futureDemand: 0.5,
  });
  assert.ok(core > peripheral, `${core} should exceed ${peripheral}`);
});

const competencyA = { _id: 'a', name: 'Survey Design', futureDemand: 0.9 };
const competencyB = { _id: 'b', name: 'Report Writing', futureDemand: 0.2 };

test('computeGaps sorts by priority and keeps mandatory rows above optional ones', () => {
  const rows = computeGaps({
    requirements: [
      { competency: competencyB, requiredLevel: 3, importance: 0.3, mandatory: false },
      { competency: competencyA, requiredLevel: 4, importance: 0.9, mandatory: true },
    ],
    currentLevels: new Map([['a', 1], ['b', 1]]),
    departmentPriority: 0.8,
  });

  assert.equal(rows[0].competency.name, 'Survey Design');
  // gap 3/5 = 0.6, context 0.5(0.9) + 0.2(0.8) + 0.3(0.9) = 0.88, priority 0.528.
  assert.equal(rows[0].band, 'critical');
  assert.ok(rows[0].priority > rows[1].priority);
});

test('computeGaps treats a competency with no record as level 0', () => {
  const [row] = computeGaps({
    requirements: [{ competency: competencyA, requiredLevel: 3, importance: 0.5 }],
    currentLevels: new Map(),
    departmentPriority: 0.5,
  });
  assert.equal(row.currentLevel, 0);
  assert.equal(row.levelsShort, 3);
});

test('roleReadiness is 1 when every requirement is met and rises with level', () => {
  const requirements = [{ competency: competencyA, requiredLevel: 4, importance: 1 }];
  const met = computeGaps({ requirements, currentLevels: new Map([['a', 4]]), departmentPriority: 0.5 });
  const partial = computeGaps({ requirements, currentLevels: new Map([['a', 2]]), departmentPriority: 0.5 });

  assert.equal(roleReadiness(met), 1);
  assert.equal(roleReadiness(partial), 0.5);
});
