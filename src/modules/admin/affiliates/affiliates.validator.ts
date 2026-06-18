import { z } from 'zod';

export const createAffiliateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  benefit: z.enum(['percent_discount', 'trial_days']).default('percent_discount'),
  benefit_value: z.number().int().min(1).default(50),
  cap: z.number().int().min(1).default(100),
  active: z.boolean().default(true),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  owner_user_id: z.string().optional(),
});

export const updateAffiliateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  benefit: z.enum(['percent_discount', 'trial_days']).optional(),
  benefit_value: z.number().int().min(1).optional(),
  cap: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  owner_user_id: z.string().optional(),
});

