import { z } from 'zod';

const moduleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(30),
});

export const createCourseSchema = z.object({
  title: z.string().min(3).max(250),
  description: z.string().min(10).max(5000),
  provider: z.string().min(2).max(120),
  source: z.enum(['IGOT', 'NSSTA', 'MOSPI', 'INTERNAL', 'MOCK', 'EXTERNAL']).optional(),
  externalId: z.string().max(120).optional(),
  url: z.string().url().max(600).optional(),
  category: z.string().min(2).max(120),
  skills: z.array(z.string().max(50)).max(20).default([]),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  durationHours: z.coerce.number().min(0).max(1000).default(4),
  language: z.string().max(10).default('en'),
  tags: z.array(z.string().max(60)).max(30).default([]),
  learningObjectives: z.array(z.string().max(300)).max(20).default([]),
  eligibility: z.string().max(500).optional(),
  modules: z.array(moduleSchema).max(60).default([]),
  thumbnail: z.string().url().max(600).optional(),
  rating: z.coerce.number().min(0).max(5).default(4),
});

export const updateCourseSchema = createCourseSchema.partial();
