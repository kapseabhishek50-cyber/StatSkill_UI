import { describe, it, expect } from 'vitest';
import {
  computeGapScore,
  computeRoleMatch,
  computeSemanticScore,
  computeDifficultyMatch,
  computePopularity,
  computeFreshness,
  computeFinalScore,
  targetLevelForExperience,
} from '../../src/services/recommendation/scoring.service';
import { rankCandidates, matchScorePercent } from '../../src/services/recommendation/ranking.service';
import type { ICourse } from '../../src/models/Course';

const makeCourse = (over: Partial<ICourse> = {}): ICourse =>
  ({
    title: 'Test Course',
    description: 'A course',
    provider: 'Test',
    source: 'MOCK',
    category: 'Testing',
    skills: ['AI_ML'],
    level: 'INTERMEDIATE',
    durationHours: 10,
    language: 'en',
    tags: [],
    learningObjectives: [],
    modules: [],
    rating: 4,
    enrollmentCount: 100,
    isActive: true,
    syncStatus: 'OK',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as ICourse;

describe('recommendation scoring components (prompt §8-10)', () => {
  const gapCtx = {
    gapByCode: new Map([
      ['AI_ML', { current: 25, required: 70, gap: 45 }],
      ['PYTHON', { current: 42, required: 60, gap: 18 }],
    ]),
  };

  it('gap score uses the strongest normalized gap across course skills (§9)', () => {
    const course = makeCourse({ skills: ['AI_ML', 'PYTHON'] });
    expect(computeGapScore(course, gapCtx)).toBeCloseTo(0.45);
    const pythonOnly = makeCourse({ skills: ['PYTHON'] });
    expect(computeGapScore(pythonOnly, gapCtx)).toBeCloseTo(0.18);
    const unknown = makeCourse({ skills: ['R'] });
    expect(computeGapScore(unknown, gapCtx)).toBe(0);
  });

  it('role match comes from the DB requirement matrix (§10)', () => {
    const roleCtx = {
      roleByCode: new Map([
        ['AI_ML', { requiredScore: 70, weight: 1 }],
        ['PYTHON', { requiredScore: 60, weight: 1 }],
      ]),
    };
    expect(computeRoleMatch(makeCourse({ skills: ['AI_ML'] }), roleCtx)).toBeCloseTo(0.7);
    expect(computeRoleMatch(makeCourse({ skills: ['PYTHON', 'AI_ML'] }), roleCtx)).toBeCloseTo(0.65);
    // skills outside the role domain score low but not zero
    expect(computeRoleMatch(makeCourse({ skills: ['STATA'] }), roleCtx)).toBeCloseTo(0.2);
    // no skills at all → neutral
    expect(computeRoleMatch(makeCourse({ skills: [] }), roleCtx)).toBeCloseTo(0.3);
  });

  it('semantic score is cosine similarity clamped to [0,1]', () => {
    expect(computeSemanticScore([1, 0], [1, 0])).toBeCloseTo(1);
    expect(computeSemanticScore(null, [1, 0])).toBe(0);
    expect(computeSemanticScore([1, 0], [])).toBe(0);
  });

  it('difficulty match rewards the target level', () => {
    expect(computeDifficultyMatch(makeCourse({ level: 'INTERMEDIATE' }), 'INTERMEDIATE')).toBe(1);
    expect(computeDifficultyMatch(makeCourse({ level: 'BEGINNER' }), 'ADVANCED')).toBe(0);
    expect(computeDifficultyMatch(makeCourse({ level: 'BEGINNER' }), 'INTERMEDIATE')).toBeCloseTo(0.5);
  });

  it('popularity blends enrollment (log scale) with rating', () => {
    const low = computePopularity(makeCourse({ enrollmentCount: 0, rating: 1 }), 1000);
    const high = computePopularity(makeCourse({ enrollmentCount: 1000, rating: 5 }), 1000);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
  });

  it('freshness decays with age', () => {
    const fresh = computeFreshness(makeCourse({ updatedAt: new Date() }));
    const old = computeFreshness(makeCourse({ updatedAt: new Date(Date.now() - 400 * 86400000) }));
    expect(fresh).toBeGreaterThan(old);
    expect(fresh).toBeLessThanOrEqual(1);
  });

  it('final score applies configurable weights (§8)', () => {
    const components = { gap: 0.45, role: 0.5, semantic: 0.5, difficulty: 1, history: 0, popularity: 0.5, freshness: 1 };
    const weights = { gap: 0.35, role: 0.2, semantic: 0.2, difficulty: 0.1, history: 0.05, popularity: 0.05, freshness: 0.05 };
    const result = computeFinalScore(components, weights);
    const expected = 0.45 * 0.35 + 0.5 * 0.2 + 0.5 * 0.2 + 1 * 0.1 + 0 + 0.5 * 0.05 + 1 * 0.05;
    expect(result.final).toBeCloseTo(expected);
  });

  it('higher gap → higher final score, all else equal (gap-driven ranking)', () => {
    const weights = { gap: 0.35, role: 0.2, semantic: 0.2, difficulty: 0.1, history: 0.05, popularity: 0.05, freshness: 0.05 };
    const base = { role: 0.5, semantic: 0.5, difficulty: 0.8, history: 0, popularity: 0.5, freshness: 1 };
    const highGap = computeFinalScore({ ...base, gap: 0.45 }, weights);
    const lowGap = computeFinalScore({ ...base, gap: 0.1 }, weights);
    expect(highGap.final).toBeGreaterThan(lowGap.final);
  });
});

describe('ranking (prompt §7)', () => {
  it('sorts by final score and applies topN', () => {
    const mk = (id: string, final: number, gap: number) => ({
      courseId: id,
      course: {},
      skillCode: null,
      skillName: null,
      priority: 'LOW' as const,
      scores: { gap, role: 0, semantic: 0, difficulty: 0, history: 0, popularity: 0, freshness: 0, final },
    });
    const ranked = rankCandidates([mk('a', 0.3, 0.1), mk('b', 0.9, 0.4), mk('c', 0.6, 0.2), mk('d', 0.1, 0)], 2);
    expect(ranked.map((r) => r.courseId)).toEqual(['b', 'c']);
  });

  it('converts final score to a 0-100 match score', () => {
    expect(matchScorePercent(0.937)).toBe(94);
  });
});

describe('target level from experience', () => {
  it('maps experience to a difficulty target', () => {
    expect(targetLevelForExperience(1)).toBe('BEGINNER');
    expect(targetLevelForExperience(5)).toBe('INTERMEDIATE');
    expect(targetLevelForExperience(12)).toBe('ADVANCED');
  });
});
