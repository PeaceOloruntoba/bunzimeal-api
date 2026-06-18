import { z } from 'zod';

export const checkoutSchema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'biannual', 'annual']),
  callback_url: z.string().url().optional(),
  referral_code: z.string().optional(),
});

export const convertSchema = z.object({
  from: z.string().default('USD'),
  amount: z.coerce.number().positive(),
});

export const webhookSchema = z.any();
