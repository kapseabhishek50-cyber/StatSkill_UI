import { AIProvider, GenerateOptions } from './AIProvider';
import { aiConfig } from '../../config/ai';
import { AIUnavailableError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const log = logger;

/** Google Gemini provider (REST — no SDK dependency). */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model = aiConfig.gemini.model;

  private async call(body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `${aiConfig.gemini.baseUrl}/models/${this.model}:generateContent?key=${aiConfig.gemini.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        log.warn({ status: res.status }, 'gemini api error');
        throw new AIUnavailableError(`Gemini API error ${res.status}`);
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new AIUnavailableError('Gemini request timed out');
      if (err instanceof AIUnavailableError) throw err;
      throw new AIUnavailableError(`Gemini request failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const data = await this.call(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
        },
      },
      options.timeoutMs ?? aiConfig.timeouts.llmMs
    );
    const candidates = data.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
    const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AIUnavailableError('Gemini returned an empty response');
    return text;
  }

  async generateJSON<T>(prompt: string, _schemaName: string, options: GenerateOptions = {}): Promise<T> {
    const data = await this.call(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxOutputTokens ?? 4096,
          responseMimeType: 'application/json',
        },
      },
      options.timeoutMs ?? aiConfig.timeouts.llmMs
    );
    const candidates = data.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
    const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AIUnavailableError('Gemini returned an empty JSON response');
    return this.parseJSON<T>(text);
  }

  private parseJSON<T>(text: string): T {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/[[{][\s\S]*[\]}]/);
      if (match) return JSON.parse(match[0]) as T;
      throw new AIUnavailableError('Gemini returned malformed JSON');
    }
  }
}
