import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration, validated once at boot.
 * In development/test almost everything has a safe default; in production the
 * auth secrets and database URI are mandatory.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.string().default('info'),

  MONGODB_URI: z.string().optional(),

  JWT_SECRET: z.string().default('dev-only-jwt-secret-change-me-please-32'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  JWT_REFRESH_SECRET: z.string().default('dev-only-refresh-secret-change-me-32x'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),

  AI_PROVIDER: z.enum(['auto', 'gemini', 'openai', 'mock']).default('auto'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().optional(),

  EMBEDDING_PROVIDER: z.enum(['auto', 'openai', 'gemini', 'local']).default('local'),
  EMBEDDING_DIM: z.coerce.number().int().min(64).max(4096).default(256),

  AI_EXPLANATION_ENABLED: z.coerce.boolean().default(true),
  AI_QUIZ_GENERATION_ENABLED: z.coerce.boolean().default(true),
  AI_ASSESSMENT_GENERATION_ENABLED: z.coerce.boolean().default(true),
  AI_ASSISTANT_ENABLED: z.coerce.boolean().default(true),

  REC_WEIGHT_GAP: z.coerce.number().default(0.35),
  REC_WEIGHT_ROLE: z.coerce.number().default(0.2),
  REC_WEIGHT_SEMANTIC: z.coerce.number().default(0.2),
  REC_WEIGHT_DIFFICULTY: z.coerce.number().default(0.1),
  REC_WEIGHT_HISTORY: z.coerce.number().default(0.05),
  REC_WEIGHT_POPULARITY: z.coerce.number().default(0.05),
  REC_WEIGHT_FRESHNESS: z.coerce.number().default(0.05),
  REC_TOP_N: z.coerce.number().int().min(1).max(50).default(10),
  REC_CANDIDATE_POOL: z.coerce.number().int().min(10).max(500).default(80),
  REC_EXCLUDE_ENROLLED: z.coerce.boolean().default(true),
  REC_EXCLUDE_COMPLETED: z.coerce.boolean().default(true),

  GAP_CRITICAL: z.coerce.number().default(40),
  GAP_HIGH: z.coerce.number().default(25),
  GAP_MEDIUM: z.coerce.number().default(10),
  COMPETENCY_UPDATE_MODE: z.enum(['blend', 'max', 'replace']).default('blend'),
  ASSESSMENT_OBSERVED_WEIGHT: z.coerce.number().min(0).max(1).default(0.7),
  QUIZ_IMPROVE_WEIGHT: z.coerce.number().min(0).max(1).default(0.4),

  XP_LESSON_COMPLETED: z.coerce.number().default(10),
  XP_QUIZ_COMPLETED: z.coerce.number().default(25),
  XP_QUIZ_HIGH_SCORE: z.coerce.number().default(40),
  XP_QUIZ_HIGH_SCORE_THRESHOLD: z.coerce.number().default(80),
  XP_STREAK_MILESTONE: z.coerce.number().default(100),
  XP_DISCUSSION_HELPFUL: z.coerce.number().default(20),
  XP_COURSE_COMPLETED: z.coerce.number().default(100),
  XP_ASSESSMENT_COMPLETED: z.coerce.number().default(50),

  MESSAGE_AUTO_HIDE_REPORTS: z.coerce.number().int().default(3),
  NOTIFY_QUIZ_PUBLISHED: z.coerce.boolean().default(true),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(20),

  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(600),
  RATE_LIMIT_GLOBAL_WINDOW_MIN: z.coerce.number().default(15),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(30),
  RATE_LIMIT_AI_MAX: z.coerce.number().default(40),

  /** How long the public landing-page stats payload is reused (protects Mongo from traffic spikes). */
  PUBLIC_STATS_CACHE_TTL_SEC: z.coerce.number().int().min(0).max(3600).default(15),

  IGOT_API_URL: z.string().optional(),
  IGOT_API_KEY: z.string().optional(),
  NSSTA_API_URL: z.string().optional(),
  NSSTA_API_KEY: z.string().optional(),
  MOSPI_API_URL: z.string().optional(),
  MOSPI_API_KEY: z.string().optional(),
  INCLUDE_MOCK_PROVIDER: z.coerce.boolean().default(true),
  SYNC_INTERVAL_MINUTES: z.coerce.number().default(0),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().optional(),

  REDIS_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

if (raw.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!raw.MONGODB_URI) missing.push('MONGODB_URI');
  if (raw.JWT_SECRET.startsWith('dev-only')) missing.push('JWT_SECRET');
  if (raw.JWT_REFRESH_SECRET.startsWith('dev-only')) missing.push('JWT_REFRESH_SECRET');
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start in production with missing/insecure env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  clientOrigins: raw.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
};

export type Env = typeof env;
