import { z } from 'zod';

export const quizQuestionSchema = z.object({
  questionId: z.string().max(60).optional(),
  question: z.string().min(8).max(1000),
  options: z.array(z.string().min(1).max(400)).length(4),
  correctAnswer: z.coerce.number().int().min(0).max(3),
  explanation: z.string().max(2000).optional(),
  topic: z.string().min(1).max(120),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  source: z.enum(['MANUAL', 'AI', 'BANK']).optional(),
});

export const createQuizSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  competencyCode: z.string().max(50).optional(),
  questions: z.array(quizQuestionSchema).min(1).max(50),
});

export const updateQuizSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(240).optional(),
  questions: z.array(quizQuestionSchema).min(1).max(50).optional(),
});

export const generateQuizSchema = z
  .object({
    materialId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    topic: z.string().min(2).max(200).optional(),
    competencyCode: z.string().max(50).optional(),
    count: z.coerce.number().int().min(3).max(20).optional(),
  })
  .refine((d) => d.materialId || d.topic || d.competencyCode, {
    message: 'Provide materialId, or topic/competencyCode',
  });

export const submitQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedIndex: z.coerce.number().int().min(-1).max(3),
      })
    )
    .min(1)
    .max(100),
  timeTakenSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});
