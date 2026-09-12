import { EmbeddingProvider } from './EmbeddingProvider';
import { LocalHashingProvider } from './LocalHashingProvider';
import { aiConfig } from '../../config/ai';
import { AIUnavailableError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const log = logger;

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly model = 'text-embedding-3-small';
  readonly dim = 1536;

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedMany([text]);
    return vec;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiConfig.timeouts.embeddingMs);
    try {
      const res = await fetch(`${aiConfig.openai.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiConfig.openai.apiKey}` },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
      if (!res.ok) throw new AIUnavailableError(`OpenAI embeddings error ${res.status}`);
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return data.data.map((d) => d.embedding);
    } catch (err) {
      if (err instanceof AIUnavailableError) throw err;
      throw new AIUnavailableError(`OpenAI embeddings failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly model = 'text-embedding-004';
  readonly dim = 768;

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedMany([text]);
    return vec;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiConfig.timeouts.embeddingMs);
    try {
      const res = await fetch(
        `${aiConfig.gemini.baseUrl}/models/${this.model}:batchEmbedContents?key=${aiConfig.gemini.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: texts.map((t) => ({
              model: `models/${this.model}`,
              content: { parts: [{ text: t }] },
              taskType: 'RETRIEVAL_DOCUMENT',
            })),
          }),
          signal: controller.signal,
        }
      );
      if (!res.ok) throw new AIUnavailableError(`Gemini embeddings error ${res.status}`);
      const data = (await res.json()) as { embeddings: { values: number[] }[] };
      return data.embeddings.map((e) => e.values);
    } catch (err) {
      if (err instanceof AIUnavailableError) throw err;
      throw new AIUnavailableError(`Gemini embeddings failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

let provider: EmbeddingProvider | null = null;

export const getEmbeddingProvider = (): EmbeddingProvider => {
  if (provider) return provider;
  switch (aiConfig.embeddingProvider) {
    case 'openai':
      provider = new OpenAIEmbeddingProvider();
      break;
    case 'gemini':
      provider = new GeminiEmbeddingProvider();
      break;
    default:
      provider = new LocalHashingProvider();
  }
  log.info(`Embedding provider: ${provider.name} (${provider.model}, dim=${provider.dim})`);
  return provider;
};
