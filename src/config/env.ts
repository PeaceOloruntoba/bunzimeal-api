import { z } from 'zod';
import * as crypto from 'crypto';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }).optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  OTP_TTL_MINUTES: z.string().default('10'),
  CORS_ORIGIN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().default('https://api.paystack.co').optional(),
  PAYSTACK_CALLBACK_URL: z.string().optional(),
  FRONTEND_BASE_URL: z.string().optional(),
  EMAIL_TO: z.string().email().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const raw = { ...process.env } as Record<string, string | undefined>;
if (!raw.JWT_SECRET && (raw.NODE_ENV ?? 'development') !== 'production') {
  raw.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[env] JWT_SECRET was not set. Generated a temporary dev secret. Tokens will reset on restart.');
}

export const env: Env = EnvSchema.parse(raw);

export const isProd = env.NODE_ENV === 'production';
export const hasDb = !!env.DATABASE_URL;