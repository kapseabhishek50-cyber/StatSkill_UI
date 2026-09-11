import { z } from 'zod';
import { MAX_LEVEL, MIN_LEVEL } from '../../config/competency.js';

/**
 * Schemas for every structured LLM call. Passed to the API via
 * `zodOutputFormat` so the model is constrained at generation time, and reused
 * to re-validate whatever comes back - the API constraint is not a substitute
 * for checking the payload we actually received.
 */

export const McqBatchSchema = z.object({
  questions: z
    .array(
      z.object({
        stem: z.string().min(20),
        options: z
          .array(z.object({ text: z.string().min(1), isCorrect: z.boolean() }))
          .min(3)
          .max(6),
        explanation: z.string().min(20),
        targetLevel: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
      }),
    )
    .min(1),
});

export const SkillExtractionSchema = z.object({
  skills: z
    .array(
      z.object({
        term: z.string().min(2),
        evidence: z.string(),
        // Level the document supports, on the same 0-5 scale as everything else.
        impliedLevel: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(40),
  experienceYears: z.number().min(0).max(60).nullable(),
  qualifications: z.array(z.string()).max(20),
});

export const PathNarrativeSchema = z.object({
  summary: z.string().min(40),
  reasoning: z.array(z.string()).min(1).max(6),
});

export const QuizFeedbackSchema = z.object({
  summary: z.string().min(20),
  strengths: z.array(z.string()).max(5),
  focusAreas: z.array(z.string()).max(5),
  nextStep: z.string().min(10),
});
