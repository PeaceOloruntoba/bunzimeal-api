import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as repo from './notifications.repo.js';
import { registerPushTokenSchema, updatePushTokenSchema } from './notifications.validator.js';

export async function getPushTokens(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const tokens = await repo.getPushTokensForUser(userId);
    return res.json({ success: true, message: 'Push tokens retrieved', data: { tokens } });
  } catch (e) {
    next(e);
  }
}

export async function registerPushToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const body = registerPushTokenSchema.parse(req.body);
    const token = await repo.registerPushToken(userId, body);
    return res.status(201).json({ success: true, message: 'Push token registered', data: { token } });
  } catch (e) {
    next(e);
  }
}

export async function updatePushToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const tokenId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = updatePushTokenSchema.parse(req.body);
    const token = await repo.updatePushToken(userId, tokenId, body);
    if (!token) return res.status(404).json({ error: 'Not Found', errorMessage: 'Push token not found' });
    
    return res.json({ success: true, message: 'Push token updated', data: { token } });
  } catch (e) {
    next(e);
  }
}

export async function deletePushToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const tokenId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await repo.deletePushToken(userId, tokenId);
    return res.json({ success: true, message: 'Push token deleted' });
  } catch (e) {
    next(e);
  }
}
