import { z } from 'zod';

export const updateContentsSchema = z.object({
  privacy_policy: z.string().optional(),
  terms_and_condition: z.string().optional(),
  refund_policy: z.string().optional(),
});

export const createFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const updateFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

