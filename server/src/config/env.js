import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..', '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

// One .env at the repo root serves both workspaces.
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

// In development a weak fallback secret keeps `npm run dev` frictionless.
// In production we refuse to boot without a real one - a guessable JWT secret
// means anyone can mint an admin token for the whole workforce dataset.
const devSecret = 'dev-only-insecure-secret-do-not-use-in-production';

export const env = {
  isProd,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/statskill',

  jwtSecret: isProd ? required('JWT_SECRET') : (process.env.JWT_SECRET || devSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  googleApiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '',
  googleModel: process.env.GOOGLE_GEMINI_MODEL ?? 'gemini-3.6-flash',
  googleApiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '',
  googleModel: process.env.GOOGLE_GEMINI_MODEL ?? 'gemini-2.0-flash',
  llmModel: process.env.LLM_MODEL ?? 'claude-opus-5',
  llmEffort: process.env.LLM_EFFORT ?? 'high',
  llmCacheEnabled: (process.env.LLM_CACHE_ENABLED ?? 'true') !== 'false',

  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  uploadDir: path.join(SERVER_ROOT, 'uploads'),

  // External API keys
  igotApiUrl: process.env.IGOT_API_URL ?? '',
  igotApiKey: process.env.IGOT_API_KEY ?? '',
  nsstaApiUrl: process.env.NSSTA_API_URL ?? '',
  nsstaApiKey: process.env.NSSTA_API_KEY ?? '',
  trainingApiUrl: process.env.TRAINING_API_URL ?? '',
  trainingApiKey: process.env.TRAINING_API_KEY ?? '',
  statisticsApiUrl: process.env.STATISTICS_API_URL ?? '',
  statisticsApiKey: process.env.STATISTICS_API_KEY ?? '',
  externalLearningApiUrl: process.env.EXTERNAL_LEARNING_API_URL ?? '',
  externalLearningApiKey: process.env.EXTERNAL_LEARNING_API_KEY ?? '',
};

if (!isProd && env.jwtSecret === devSecret) {
  console.warn('[env] JWT_SECRET is unset - using the insecure development fallback.');
}
