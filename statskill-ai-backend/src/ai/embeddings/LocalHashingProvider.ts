import { EmbeddingProvider } from './EmbeddingProvider';
import { env } from '../../config/env';
import { fnv1a, l2Normalize } from '../../utils/math';

const STOPWORDS = new Set(
  ('a an and are as at be by for from has have in is it its of on or that the to with this these those ' +
    'will can into not you your our their course learn learning skill skills').split(' ')
);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

/**
 * Deterministic in-process embedder: hashed bag of unigrams+bigrams with
 * sublinear term frequency and L2 normalisation. No network, no cost, stable
 * across restarts — powers semantic search/recommendations when no embedding
 * API key is configured.
 */
export class LocalHashingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly model = 'hashed-unigram-bigram';
  readonly dim = env.EMBEDDING_DIM;

  async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedSync(t));
  }

  private embedSync(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    const tokens = tokenize(text);
    if (!tokens.length) return vec;

    const counts = new Map<string, number>();
    for (let i = 0; i < tokens.length; i++) {
      const unigram = tokens[i];
      counts.set(unigram, (counts.get(unigram) ?? 0) + 1);
      if (i + 1 < tokens.length) {
        const bigram = `${unigram}_${tokens[i + 1]}`;
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
      }
    }
    for (const [term, count] of counts) {
      const idx = fnv1a(term) % this.dim;
      vec[idx] += 1 + Math.log(count); // sublinear tf
    }
    return l2Normalize(vec);
  }
}
