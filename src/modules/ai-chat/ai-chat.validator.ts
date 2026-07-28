import { z } from 'zod';

const PERSONA_ENUM = ['dietitian', 'nutritionist', 'chef', 'health-coach'] as const;

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  stream: z.boolean().optional().default(false),
  persona: z.enum(PERSONA_ENUM).optional().default('dietitian'),
});

export const sessionRequestSchema = z.object({
  persona: z.enum(PERSONA_ENUM).optional().default('dietitian'),
});

export const planRequestSchema = z.object({
  days: z.number().int().positive().optional().default(7),
  mealsPerDay: z.number().int().positive().optional().default(3),
  max_prep_minutes: z.number().int().positive().optional(),
  prompt: z.string().optional(),
  budget: z.any().optional(),
  plan: z.any().optional(),
  persona: z.enum(PERSONA_ENUM).optional().default('dietitian'),
});
