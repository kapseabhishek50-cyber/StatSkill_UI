import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { mockProvider } from './mock.js';

/**
 * The seam every caller uses. Nothing outside this directory imports a provider
 * directly, so swapping providers, adding a cache, or falling back never touches
 * a route.
 *
 * Four behaviours worth knowing about:
 *
 * 1. Provider choice is by key presence, not a flag. No ANTHROPIC_API_KEY means
 *    the deterministic mock, and the app still works end to end.
 * 2. The live provider is imported lazily, on first use. A statically imported
 *    provider evaluates the Anthropic SDK at boot even when no key is set, which
 *    turns any SDK packaging problem into a server that will not start - the
 *    offline path must not depend on a dependency it never calls.
 * 3. Results are cached in process when LLM_CACHE_ENABLED is on. This is for the
 *    demo: the second run of the same path is instant and identical, so a live
 *    walkthrough never waits on generation or gets different wording halfway.
 * 4. A live failure degrades to the mock rather than 500-ing the request. Every
 *    return carries `llmSource` ('live' | 'cache' | 'mock') so the interface can
 *    say which it was, and so a stored Recommendation records how it was made.
 */

const CACHE_LIMIT = 200;
const cache = new Map();

/** null = not attempted, false = unavailable, object = the loaded provider. */
let liveProvider = null;
let liveLoadFailed = false;

/**
 * Loads the live provider once. A load failure is recorded, logged once, and
 * never retried - if the SDK cannot be imported, it will not import next request
 * either, and a per-request retry would only add latency to every call.
 */
async function loadLive() {
  if (!env.anthropicApiKey || liveLoadFailed) return null;
  if (liveProvider) return liveProvider;

  try {
    const { anthropicProvider } = await import('./anthropic.js');
    liveProvider = anthropicProvider;
    return liveProvider;
  } catch (error) {
    liveLoadFailed = true;
    console.warn(
      `[llm] ANTHROPIC_API_KEY is set but the SDK could not be loaded, using templates: ${error.message}`,
    );
    return null;
  }
}

/**
 * What the health endpoint reports. Read at call time, not at import: it starts
 * as the configured provider and becomes 'mock' if the live load later fails, so
 * /health describes what is actually answering rather than what was intended.
 */
export function llmProviderName() {
  if (env.googleApiKey) return 'google-gemini';
  if (!env.anthropicApiKey || liveLoadFailed) return mockProvider.name;
  return 'anthropic';
}

function cacheKey(method, payload) {
  return createHash('sha256')
    .update(method)
    .update(JSON.stringify(payload, replacer))
    .digest('hex')
    .slice(0, 32);
}

/** ObjectIds and Dates would otherwise serialise inconsistently across calls. */
function replacer(_key, value) {
  if (value && typeof value === 'object' && typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  return value instanceof Date ? value.toISOString() : value;
}

function remember(key, value) {
  if (!env.llmCacheEnabled) return value;
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

/**
 * Runs `method` on the live provider, with cache in front and the mock behind.
 * `keyPayload` is the subset of args that actually determines the output - the
 * full args include Mongoose documents whose timestamps would defeat the cache.
 */
async function dispatch(method, args, keyPayload) {
  const key = cacheKey(method, keyPayload);

  if (env.llmCacheEnabled && cache.has(key)) {
    return { ...cache.get(key), llmSource: 'cache' };
  }

  const live = await loadLive();
  if (live) {
    try {
      const result = await live[method](args);
      remember(key, result);
      return { ...result, llmSource: 'live' };
    } catch (error) {
      // Surfaced to the operator, not the learner: the learner gets templates.
      console.warn(`[llm] ${method} fell back to mock: ${error.message}`);
    }
  }

  const result = await mockProvider[method](args);
  remember(key, result);
  return { ...result, llmSource: 'mock' };
}

export function generateMcqs(args) {
  const { competency, targetLevel, count, courseTitle } = args;
  return dispatch('generateMcqs', args, {
    competency: competency?.code ?? competency?.name,
    targetLevel,
    count,
    courseTitle,
  });
}

export function extractSkills(args) {
  return dispatch('extractSkills', args, { documentText: args.documentText });
}

export function explainPath(args) {
  const { user: officer, jobRole, gapRows } = args;
  return dispatch('explainPath', args, {
    user: officer?._id,
    jobRole: jobRole?.code ?? jobRole?.title,
    // Only the numbers that drive the narrative - not the populated documents.
    gaps: gapRows.map((row) => [row.competencyId, row.currentLevel, row.requiredLevel, row.priority]),
  });
}

export function quizFeedback(args) {
  const { competency, targetLevel, answers, scoreRatio, passed } = args;
  return dispatch('quizFeedback', args, {
    competency: competency?.code ?? competency?.name,
    targetLevel,
    scoreRatio,
    passed,
    answers: answers.map((answer) => [answer.stem, answer.isCorrect]),
  });
}

export async function answerAssistant(args) {
  if (env.googleApiKey) {
    try {
      const { googleProvider } = await import('./google.js');
      const result = await googleProvider.answerAssistant(args);
      return { ...result, llmSource: 'google' };
    } catch (error) {
      console.warn(`[llm] assistant fell back to local answers: ${error.message}`);
    }
  }
  const result = await mockProvider.answerAssistant(args);
  return { ...result, llmSource: 'mock' };
}

/** Test hook - a cached result from one case must not leak into the next. */
export function clearLlmCache() {
  cache.clear();
}
