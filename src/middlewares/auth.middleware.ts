import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { query } from '../db/pool.js';
import { unauthorized } from '../utils/response.js';

export type AuthedRequest = Request & { user?: { id: string; email: string; role: 'user' | 'admin' } };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return unauthorized(res, 'Authentication required');
  try {
    const payload = verifyToken<{ sub: string; email: string; tv?: number }>(token);
    const { rows } = await query<{ token_version: number; role: 'user' | 'admin'; deleted_at: string | null }>('SELECT token_version, role, deleted_at FROM users WHERE id=$1', [payload.sub]);
    if (!rows.length) return unauthorized(res, 'Invalid token');
    const { token_version, role, deleted_at } = rows[0];
    if (deleted_at) return res.status(403).json({ error: 'Forbidden', errorMessage: 'Account disabled' });
    if ((payload.tv ?? 0) !== token_version) return unauthorized(res, 'Token revoked');
    req.user = { id: payload.sub, email: payload.email, role };
    next();
  } catch {
    return unauthorized(res, 'Invalid token');
  }
}

export async function fakeAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyToken<{ sub: string; email: string; tv?: number }>(token);
      const { rows } = await query<{ token_version: number; role: 'user' | 'admin'; deleted_at: string | null }>('SELECT token_version, role, deleted_at FROM users WHERE id=$1', [payload.sub]);
      if (rows.length && !rows[0].deleted_at && (payload.tv ?? 0) === rows[0].token_version) {
        req.user = { id: payload.sub, email: payload.email, role: rows[0].role };
      }
    } catch {
      // If token verification fails, still continue
    }
  }
  if (!req.user) {
    req.user = { id: 'fake-user-id', email: 'fake@example.com', role: 'user' };
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return unauthorized(res, 'Authentication required');
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden', errorMessage: 'Admin access required' });
  next();
}
