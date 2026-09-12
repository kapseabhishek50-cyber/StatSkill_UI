import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalizeWeights, clamp, l2Normalize } from '../../src/utils/math';

describe('cosine similarity (prompt §11)', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is scale invariant', () => {
    const s = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    const s2 = cosineSimilarity([10, 20, 30], [4, 5, 6]);
    expect(s).toBeCloseTo(s2);
  });

  it('handles zero vectors safely', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('matches the dot/(norm*norm) definition', () => {
    const a = [0.1, 0.5, -0.2, 0.8];
    const b = [0.4, -0.1, 0.3, 0.6];
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(cosineSimilarity(a, b)).toBeCloseTo(dot / (norm(a) * norm(b)));
  });
});

describe('weight normalization', () => {
  it('normalizes configured weights to sum to 1', () => {
    const w = normalizeWeights({ a: 0.35, b: 0.2, c: 0.2, d: 0.1, e: 0.05, f: 0.05, g: 0.05 });
    const sum = Object.values(w).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1);
    expect(w.a).toBeCloseTo(0.35);
  });

  it('rescales when the configured weights do not sum to 1', () => {
    const w = normalizeWeights({ a: 2, b: 2 });
    expect(w.a).toBeCloseTo(0.5);
    expect(w.b).toBeCloseTo(0.5);
  });
});

describe('misc math', () => {
  it('clamps', () => {
    expect(clamp(1.5)).toBe(1);
    expect(clamp(-2)).toBe(0);
    expect(clamp(0.5)).toBe(0.5);
  });

  it('l2-normalizes', () => {
    const v = l2Normalize([3, 4]);
    expect(Math.hypot(...v)).toBeCloseTo(1);
  });
});
