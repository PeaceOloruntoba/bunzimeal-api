import { z } from 'zod';
import * as crypto from 'crypto';

const cloudinaryUrlPattern = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/;

function parseCloudinaryUrl(url: string) {
  const match = url.match(cloudinaryUrlPattern);
  if (!match) {
    throw new Error('CLOUDINARY_URL must follow cloudinary://<api_key>:<api_secret>@<cloud_name>');
  }
  return {
    CLOUDINARY_API_KEY: match[1],
    CLOUDINARY_API_SECRET: match[2],
    CLOUDINARY_CLOUD_NAME: match[3],
  };
}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }).optional(),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),
    PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
    PAYSTACK_CALLBACK_URL: z.string().url().optional(),
    CLOUDINARY_URL: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default('bunzimeal/uploads'),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),
    BREVO_API_KEY: z.string().min(1).optional(),
    OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    CORS_ORIGIN: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    FRONTEND_BASE_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;

    const required: Array<keyof typeof data> = [
      'DATABASE_URL',
      'PAYSTACK_SECRET_KEY',
      'CLOUDINARY_URL',
      'OPENAI_API_KEY',
      'BREVO_API_KEY',
    ];

    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

const raw = { ...process.env } as Record<string, string | undefined>;

if (!raw.JWT_SECRET && (raw.NODE_ENV ?? 'development') !== 'production') {
  raw.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[env] JWT_SECRET was not set. Generated a temporary dev secret. Tokens will reset on restart.');
}

if (raw.CLOUDINARY_URL && !raw.CLOUDINARY_CLOUD_NAME) {
  const parsed = parseCloudinaryUrl(raw.CLOUDINARY_URL);
  Object.assign(raw, parsed);
}

const parsedEnv = EnvSchema.parse(raw);

export const env: Env = parsedEnv;

export const isProd = env.NODE_ENV === 'production';
export const hasDb = !!env.DATABASE_URL;

export const cloudinaryConfig = {
  cloudName: env.CLOUDINARY_CLOUD_NAME,
  apiKey: env.CLOUDINARY_API_KEY,
  apiSecret: env.CLOUDINARY_API_SECRET,
  folder: env.CLOUDINARY_FOLDER,
};

export const hasCloudinary =
  !!env.CLOUDINARY_CLOUD_NAME && !!env.CLOUDINARY_API_KEY && !!env.CLOUDINARY_API_SECRET;

export const hasBrevo = !!env.BREVO_API_KEY;
export const hasOpenAi = !!env.OPENAI_API_KEY;
export const hasPaystack = !!env.PAYSTACK_SECRET_KEY;
