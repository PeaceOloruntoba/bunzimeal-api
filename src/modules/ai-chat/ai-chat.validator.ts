import { z } from 'zod';

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  stream: z.boolean().optional().default(false),
  persona: z.enum(['dietitian', 'nutritionist', 'chef']).optional().default('dietitian'),
});

export const planRequestSchema = z.object({
  days: z.number().int().positive().optional().default(7),
  mealsPerDay: z.number().int().positive().optional().default(3),
  max_prep_minutes: z.number().int().positive().optional(),
  prompt: z.string().optional(),
  budget: z.any().optional(),
  plan: z.any().optional(),
});
