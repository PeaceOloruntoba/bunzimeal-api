import { z } from 'zod';

export const updateGoalsSchema = z.object({
  goals: z.array(z.string()).min(1),
});

export const createHealthLogSchema = z.object({
  log_date: z.string().optional(),
  log_type: z.enum(['weight', 'water', 'calories', 'protein', 'custom']),
  value: z.coerce.number(),
  unit: z.string().min(1),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

export const updateHealthLogSchema = z.object({
  value: z.coerce.number().optional(),
  unit: z.string().min(1).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

export const listHealthLogsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
