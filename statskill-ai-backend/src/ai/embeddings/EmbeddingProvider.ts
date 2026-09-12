/** Embedding provider abstraction — swappable via EMBEDDING_PROVIDER env. */
export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
