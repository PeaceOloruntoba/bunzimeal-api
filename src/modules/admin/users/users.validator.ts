import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

export const updateUserSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  country_id: z.number().int().optional(),
});

