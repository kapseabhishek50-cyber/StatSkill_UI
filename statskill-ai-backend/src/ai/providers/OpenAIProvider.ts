import { AIProvider, GenerateOptions } from './AIProvider';
import { aiConfig } from '../../config/ai';
import { AIUnavailableError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const log = logger;

/** OpenAI-compatible provider (works with any OpenAI-compatible endpoint). */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model = aiConfig.openai.model;

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.openai.apiKey}`,
    };
  }

  private async call(body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${aiConfig.openai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ status: res.status }, 'openai api error');
        throw new AIUnavailableError(`OpenAI API error ${res.status}`);
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new AIUnavailableError('OpenAI request timed out');
      if (err instanceof AIUnavailableError) throw err;
      throw new AIUnavailableError(`OpenAI request failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private static extractText(data: Record<string, unknown>): string {
    const choices = data.choices as { message?: { content?: string } }[] | undefined;
    const text = choices?.[0]?.message?.content ?? '';
    if (!text) throw new AIUnavailableError('OpenAI returned an empty response');
    return text;
  }

  private static parseJSON<T>(text: string): T {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/[[{][\s\S]*[\]}]/);
      if (match) return JSON.parse(match[0]) as T;
      throw new AIUnavailableError('OpenAI returned malformed JSON');
    }
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: prompt });
    const data = await this.call(
      {
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxOutputTokens ?? 2048,
      },
      options.timeoutMs ?? aiConfig.timeouts.llmMs
    );
    return OpenAIProvider.extractText(data);
  }

  async generateJSON<T>(prompt: string, _schemaName: string, options: GenerateOptions = {}): Promise<T> {
    const messages: { role: string; content: string }[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: prompt });
    const data = await this.call(
      {
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxOutputTokens ?? 4096,
        response_format: { type: 'json_object' },
      },
      options.timeoutMs ?? aiConfig.timeouts.llmMs
    );
    return OpenAIProvider.parseJSON<T>(OpenAIProvider.extractText(data));
  }
}
