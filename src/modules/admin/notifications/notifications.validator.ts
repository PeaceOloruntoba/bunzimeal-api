import { z } from 'zod';

export const createNewsletterSchema = z.object({
  title: z.string().min(1),
  body_html: z.string().min(1),
  is_admin_only: z.boolean().optional().default(false),
  exclude_user_ids: z.array(z.string()).optional().default([]),
});

export const previewNewsletterSchema = z.object({
  body_html: z.string().min(1),
  user_id: z.string().optional(),
});

