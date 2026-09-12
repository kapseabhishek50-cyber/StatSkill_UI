import pino from 'pino';
import { env } from '../config/env';

/** Structured logger. Secrets are never logged (redacted). */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'statskill-ai-backend' },
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'req.headers.authorization',
      'token',
      '*.token',
      'refreshToken',
      'apiKey',
      '*.apiKey',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const getLogger = (module: string) => logger.child({ module });
