import { z } from 'zod';

export const startAssessmentSchema = z.object({
  competencyCodes: z.array(z.string().max(50)).max(10).optional(),
  questionCount: z.coerce.number().int().min(5).max(30).optional(),
  type: z.enum(['ROLE_BASED', 'FULL', 'COMPETENCY', 'DIAGNOSTIC']).optional(),
});

/**
 * Self-assessment: the officer rates themselves 0-5 per required competency.
 * A self-rating is evidence, not a recorded level — stored with source
 * SELF_REPORTED and low confidence so a later quiz result overrides it.
 */
export const selfAssessmentSchema = z.object({
  responses: z
    .array(
      z.object({
        competency: z.string().regex(/^[0-9a-fA-F]{24}$/),
        selfLevel: z.coerce.number().int().min(0).max(5),
      })
    )
    .min(1)
    .max(60),
});

export const submitAssessmentSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedIndex: z.coerce.number().int().min(-1).max(3),
      })
    )
    .min(1),
  timeTakenSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});
