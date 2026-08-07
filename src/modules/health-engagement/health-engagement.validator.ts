import { z } from 'zod';

export const LOG_TYPES = [
  'weight', 'water', 'calories', 'protein', 'fat', 'carbs',
  'sleep', 'steps', 'exercise',
  'systolic_bp', 'diastolic_bp', 'heart_rate',
  'mood', 'energy', 'custom'
] as const;

export const updateGoalsSchema = z.object({
  goals: z.array(z.string()).min(1),
});

export const createHealthLogSchema = z.object({
  log_date: z.string().optional(),
  log_type: z.enum(LOG_TYPES),
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
  log_type: z.enum(LOG_TYPES).optional(),
});

export const createCheckinSchema = z.object({
  checkin_date: z.string().optional(),
  mood: z.coerce.number().int().min(1).max(5).optional(),
  energy: z.coerce.number().int().min(1).max(5).optional(),
  hunger: z.coerce.number().int().min(1).max(5).optional(),
  cravings: z.string().optional(),
  symptoms: z.string().optional(),
  bowel_movement: z.coerce.boolean().optional(),
  water_cups: z.coerce.number().int().min(0).optional(),
  steps_count: z.coerce.number().int().min(0).optional(),
  exercise_minutes: z.coerce.number().int().min(0).optional(),
  sleep_hours: z.coerce.number().min(0).optional(),
  weight: z.coerce.number().min(0).optional(),
  journal: z.string().optional(),
  gratitude: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

export const listCheckinsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const healthSummarySchema = z.object({
  period: z.enum(['1d', 'today', '7d', '30d', '90d']).default('7d'),
});

export const bulkLogSchema = z.object({
  log_date: z.string().optional(),
  entries: z.array(
    z.object({
      log_type: z.enum(LOG_TYPES),
      value: z.coerce.number(),
      unit: z.string().min(1),
      notes: z.string().optional(),
    })
  ).min(1),
});

export const readRecommendationsSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.coerce.boolean().optional(),
});
