import { z } from 'zod';

export const shoppingItemCreateSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().optional().nullable(),
});

export const shoppingItemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.string().optional().nullable(),
  checked: z.boolean().optional(),
});
