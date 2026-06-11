import { query } from '../db/pool.js';
import { Request, Response, NextFunction } from 'express';

export function dbRateLimit(opts: { keyPrefix: string; windowMs: number; limit: number }) {
  const { keyPrefix, windowMs, limit } = opts;
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
      const userId = (req as any).user?.id as string | undefined;
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;
      const key = `${keyPrefix}:${identifier}`;
      const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
      const q = `INSERT INTO rate_limits(key, window_start, count, created_at, updated_at)
        VALUES($1,$2,1,NOW(),NOW())
        ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1, updated_at = NOW()
        RETURNING count`;
      const { rows } = await query(q, [key, windowStart]);
      const current = rows?.[0]?.count ?? 1;
      if (current > limit) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Utility cleanup job (optional): remove old rate limit rows
export async function cleanupRateLimits(olderThanMs = 1000 * 60 * 60 * 24 * 2) {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  await query('DELETE FROM rate_limits WHERE window_start < $1', [cutoff]);
}
import rateLimitPkg from 'express-rate-limit';

const rateLimit = (rateLimitPkg as any).default ?? (rateLimitPkg as any);

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});