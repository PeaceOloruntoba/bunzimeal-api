import { z } from 'zod';

export const pantryItemCreateSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export const pantryItemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});
