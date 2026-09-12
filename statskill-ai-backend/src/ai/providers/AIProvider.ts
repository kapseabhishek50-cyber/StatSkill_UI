/**
 * LLM provider abstraction (prompt §29). Controllers NEVER call providers
 * directly — flow is always Controller → Service → AIProvider. Swap providers
 * via AI_PROVIDER env config.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Free-form text generation. */
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  /** Structured JSON generation — implementations should force JSON output. */
  generateJSON<T>(prompt: string, schemaName: string, options?: GenerateOptions): Promise<T>;
}

export interface GenerateOptions {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Retry hints for transient failures. */
  timeoutMs?: number;
}
