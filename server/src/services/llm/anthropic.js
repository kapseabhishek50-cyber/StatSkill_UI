import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { env } from '../../config/env.js';
import {
  McqBatchSchema,
  PathNarrativeSchema,
  QuizFeedbackSchema,
  SkillExtractionSchema,
} from './schemas.js';
import { mcqPrompt, pathNarrativePrompt, quizFeedbackPrompt, skillExtractionPrompt } from './prompts.js';

/**
 * Live Anthropic provider.
 *
 * Every call is a structured output - `messages.parse()` with a Zod schema, so
 * the model is constrained at generation time and the SDK hands back a typed
 * object instead of a string we have to hope parses. Callers still run their own
 * checks on the result (see mcqValidator): a schema guarantees shape, not sense.
 *
 * No prompt caching here on purpose. The stable system prefix is only ~300
 * tokens, well under the minimum cacheable prefix, so a cache_control breakpoint
 * would add moving parts and cache nothing. Revisit if the system prompt grows
 * to include the full competency framework.
 *
 * This module is only ever imported when an API key is configured (see index.js),
 * so constructing the client at module scope is safe here.
 */

const client = new Anthropic({ apiKey: env.anthropicApiKey });

class LlmRefusal extends Error {
  constructor(details) {
    super(`Model declined the request (${details?.category ?? 'unspecified'}).`);
    this.name = 'LlmRefusal';
    this.details = details;
  }
}

async function callStructured({ system, user, schema, maxTokens = 16000 }) {
  try {
    const response = await client.messages.parse({
      model: env.llmModel,
      max_tokens: maxTokens,
      system,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: env.llmEffort,
        format: zodOutputFormat(schema),
      },
      messages: [{ role: 'user', content: user }],
    });

    // A refusal is HTTP 200 with no usable content - check before reading.
    if (response.stop_reason === 'refusal') {
      throw new LlmRefusal(response.stop_details);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Generation hit max_tokens and is truncated.');
    }
    if (!response.parsed_output) {
      throw new Error('Model returned no parsable output for the requested schema.');
    }

    return { data: response.parsed_output, model: response.model, usage: response.usage };
  } catch (error) {
    // Most specific first. The caller decides whether to fall back or surface.
    if (error instanceof LlmRefusal) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error('ANTHROPIC_API_KEY is missing or invalid.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error('Anthropic rate limit hit - retry shortly.');
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new Error(`Rejected by the API: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error ${error.status}: ${error.message}`);
    }
    throw error;
  }
}

export const anthropicProvider = {
  name: 'anthropic',

  async generateMcqs({ competency, targetLevel, count, courseTitle }) {
    const { system, user } = mcqPrompt({ competency, targetLevel, count, courseTitle });
    const { data, model } = await callStructured({ system, user, schema: McqBatchSchema });
    return { questions: data.questions, model };
  },

  async extractSkills({ documentText, competencyList }) {
    const { system, user } = skillExtractionPrompt({ documentText, competencyList });
    const { data, model } = await callStructured({ system, user, schema: SkillExtractionSchema });
    return { ...data, model };
  },

  async explainPath({ user: officer, jobRole, gapRows }) {
    const { system, user } = pathNarrativePrompt({ user: officer, jobRole, gapRows });
    const { data, model } = await callStructured({
      system,
      user,
      schema: PathNarrativeSchema,
      maxTokens: 4000,
    });
    return { ...data, model };
  },

  async quizFeedback({ competency, targetLevel, answers, scoreRatio, passed }) {
    const { system, user } = quizFeedbackPrompt({ competency, targetLevel, answers, scoreRatio, passed });
    const { data, model } = await callStructured({
      system,
      user,
      schema: QuizFeedbackSchema,
      maxTokens: 4000,
    });
    return { ...data, model };
  },
};
