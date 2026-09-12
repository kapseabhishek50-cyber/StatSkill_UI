import { describe, it, expect } from 'vitest';
import { computeGap, computePriority, normalizeGapScore } from '../../src/services/competency/competencyScore.service';
import { priorityForGap } from '../../src/config/competency';

/** Skill-gap calculation (prompt §5-6, §9). */
describe('skill gap calculation', () => {
  it('computes gap = required - current', () => {
    expect(computeGap(25, 70)).toBe(45);
    expect(computeGap(82, 75)).toBe(0);
    expect(computeGap(0, 60)).toBe(60);
  });

  it('never returns negative gaps', () => {
    expect(computeGap(90, 70)).toBe(0);
  });

  it('applies configurable priority thresholds', () => {
    // default thresholds: >=40 CRITICAL, >=25 HIGH, >=10 MEDIUM, <10 LOW
    expect(priorityForGap(45)).toBe('CRITICAL');
    expect(priorityForGap(40)).toBe('CRITICAL');
    expect(priorityForGap(39.9)).toBe('HIGH');
    expect(priorityForGap(25)).toBe('HIGH');
    expect(priorityForGap(24)).toBe('MEDIUM');
    expect(priorityForGap(10)).toBe('MEDIUM');
    expect(priorityForGap(9)).toBe('LOW');
    expect(computePriority(0)).toBe('LOW');
  });

  it('normalizes gap to [0,1] for the recommendation engine', () => {
    expect(normalizeGapScore(45)).toBeCloseTo(0.45);
    expect(normalizeGapScore(100)).toBe(1);
    expect(normalizeGapScore(0)).toBe(0);
    expect(normalizeGapScore(-5)).toBe(0);
  });
});
