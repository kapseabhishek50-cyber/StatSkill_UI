/** Math helpers shared by the embedding + recommendation engines. */

/** Cosine similarity between two vectors. Returns 0 for empty/mismatched input. */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

/** FNV-1a 32-bit hash — deterministic, used by the local embedder. */
export const fnv1a = (str: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const l2Normalize = (vec: number[]): number[] => {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
};

/** Normalizes a weights record so values sum to 1 (keeps zeros, rescales positives). */
export const normalizeWeights = <T extends string>(weights: Record<T, number>): Record<T, number> => {
  const keys = Object.keys(weights) as T[];
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);
  if (total <= 0) {
    const even = 1 / Math.max(1, keys.length);
    return Object.fromEntries(keys.map((k) => [k, even])) as Record<T, number>;
  }
  return Object.fromEntries(keys.map((k) => [k, Math.max(0, weights[k]) / total])) as Record<T, number>;
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;
