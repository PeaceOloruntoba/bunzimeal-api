import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../../middlewares/auth.middleware.js';
import * as service from './affiliate-requests.service.js';

export async function listAffiliateRequests(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const requests = await service.listAffiliateRequests();
    res.json(requests);
  } catch (e) {
    next(e);
  }
}

export async function approveRequest(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const result = await service.approveRequest(id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    if ((e as Error).message === 'Already approved') {
      return res.status(409).json({ error: 'Already approved' });
    }
    next(e);
  }
}

export async function rejectRequest(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const result = await service.rejectRequest(id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

