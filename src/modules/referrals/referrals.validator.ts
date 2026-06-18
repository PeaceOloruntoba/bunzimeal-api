import { z } from 'zod';

export const redeemReferralSchema = z.object({
  code: z.string(),
});

export const requestAffiliateSchema = z.object({
  pitch: z.string().optional(),
  social_links: z.array(z.string()).optional().default([]),
});
