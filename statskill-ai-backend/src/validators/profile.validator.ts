import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    designation: z.string().max(120).optional(),
    cadre: z.string().max(120).optional(),
    department: z.string().max(120).optional(),
    postingLocation: z.string().max(160).optional(),
    organization: z.string().max(160).optional(),
    experience: z.coerce.number().min(0).max(50).optional(),
    experienceYears: z.coerce.number().min(0).max(50).optional(),
    education: z.string().max(160).optional(),
    qualifications: z.array(z.string().max(160)).max(20).optional(),
    preferredLanguage: z.string().max(10).optional(),
    avatar: z.string().url().max(500).optional(),
    interests: z.array(z.string().max(60)).max(20).optional(),
    learningGoals: z.array(z.string().max(120)).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
