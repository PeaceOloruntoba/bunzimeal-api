import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../../middlewares/auth.middleware.js';
import * as service from './users.service.js';
import { listUsersQuerySchema, updateUserSchema } from './users.validator.js';

export async function listUsers(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { limit, offset, search } = listUsersQuerySchema.parse(req.query);
    const users = await service.listUsers(limit, offset, search);
    res.json(users);
  } catch (e) {
    next(e);
  }
}

export async function getUserById(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = await service.getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    next(e);
  }
}

export async function updateUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const data = updateUserSchema.parse(req.body);
    const updated = await service.updateUser(id, data);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

