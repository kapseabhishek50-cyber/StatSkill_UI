import { env } from './env';

export type LLMProviderName = 'gemini' | 'openai' | 'mock';
export type EmbeddingProviderName = 'openai' | 'gemini' | 'local';

/** Resolves the LLM provider: explicit config, else the first configured key, else mock. */
export const resolveLLMProvider = (): LLMProviderName => {
  if (env.AI_PROVIDER !== 'auto') return env.AI_PROVIDER;
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.OPENAI_API_KEY) return 'openai';
  return 'mock';
};

/** Resolves the embedding provider. "local" is the zero-cost deterministic default. */
export const resolveEmbeddingProvider = (): EmbeddingProviderName => {
  if (env.EMBEDDING_PROVIDER === 'auto') {
    if (env.GEMINI_API_KEY) return 'gemini';
    if (env.OPENAI_API_KEY) return 'openai';
    return 'local';
  }
  return env.EMBEDDING_PROVIDER;
};

export const aiConfig = {
  get llmProvider(): LLMProviderName {
    return resolveLLMProvider();
  },
  get embeddingProvider(): EmbeddingProviderName {
    return resolveEmbeddingProvider();
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    get apiKey() {
      return env.GEMINI_API_KEY ?? '';
    },
    get model() {
      return env.GEMINI_MODEL;
    },
  },
  openai: {
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    get apiKey() {
      return env.OPENAI_API_KEY ?? '';
    },
    get model() {
      return env.OPENAI_MODEL;
    },
  },
  features: {
    explanation: env.AI_EXPLANATION_ENABLED,
    quizGeneration: env.AI_QUIZ_GENERATION_ENABLED,
    assessmentGeneration: env.AI_ASSESSMENT_GENERATION_ENABLED,
    assistant: env.AI_ASSISTANT_ENABLED,
  },
  timeouts: { llmMs: 30_000, embeddingMs: 15_000 },
};

export const isLLMConfigured = (): boolean => resolveLLMProvider() !== 'mock';
export const isEmbeddingRemote = (): boolean => resolveEmbeddingProvider() !== 'local';
