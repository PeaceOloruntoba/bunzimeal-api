import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken } from '../utils/jwt.js';
import { query } from '../db/pool.js';
import { forbidden, unauthorized } from '../utils/response.js';

export type AuthedRequest = Request & {
  user?: { id: string; email: string; role: 'user' | 'admin' };
};

export async function authenticateBearer(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return unauthorized(res, 'Missing Bearer token');
  }

  try {
    const payload = verifyToken<{ sub: string; email: string; tv?: number }>(token);

    const { rows } = await query<{
      token_version: number;
      role: 'user' | 'admin';
      deleted_at: string | null;
    }>('SELECT token_version, role, deleted_at FROM users WHERE id = $1', [payload.sub]);

    if (!rows.length) {
      return unauthorized(res, 'Invalid token');
    }

    const { token_version, role, deleted_at } = rows[0];

    if (deleted_at) {
      return forbidden(res, 'Account disabled');
    }

    if ((payload.tv ?? 0) !== token_version) {
      return unauthorized(res, 'Token revoked');
    }

    req.user = { id: payload.sub, email: payload.email, role };
    next();
  } catch {
    return unauthorized(res, 'Invalid token');
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return unauthorized(res, 'Authentication required');
  }
  if (req.user.role !== 'admin') {
    return forbidden(res, 'Admin access required');
  }
  next();
}
