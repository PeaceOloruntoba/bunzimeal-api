import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token: z.string().min(1),
  device_info: z.any().optional(),
  expires_at: z.string().optional(),
});

export const updatePushTokenSchema = z.object({
  is_active: z.boolean().optional(),
  device_info: z.any().optional(),
  expires_at: z.string().optional(),
});
