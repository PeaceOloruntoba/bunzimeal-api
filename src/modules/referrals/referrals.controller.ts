import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './referrals.service.js';
import * as repo from './referrals.repo.js';
import { redeemReferralSchema, requestAffiliateSchema } from './referrals.validator.js';

export async function validateReferralCode(req: Request, res: Response, next: NextFunction) {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code required' });
    
    const affiliate = await service.getAffiliateByCode(code);
    if (!affiliate) return res.status(404).json({ error: 'invalid code' });
    
    const now = new Date();
    const withinWindow =
      (!affiliate.starts_at || new Date(affiliate.starts_at) <= now) &&
      (!affiliate.ends_at || new Date(affiliate.ends_at) >= now);
    
    return res.json({
      valid: affiliate.active && withinWindow,
      affiliate: {
        name: affiliate.name,
        code: affiliate.code,
        benefit: affiliate.benefit,
        benefit_value: affiliate.benefit_value,
        cap: affiliate.cap,
        active: affiliate.active,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function redeemReferral(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const body = redeemReferralSchema.parse(req.body);
    const result = await service.redeem(userId, body.code);
    
    if ('error' in result) {
      const statusMap: Record<string, number> = { invalid: 404, inactive: 400, window: 400, capacity: 409, already_redeemed: 409 };
      return res.status(statusMap[result.error] || 400).json({ error: result.error });
    }
    
    return res.json({ message: 'redeemed', affiliate: result.affiliate });
  } catch (e) {
    next(e);
  }
}

export async function requestAffiliate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const body = requestAffiliateSchema.parse(req.body);
    const existing = await repo.getAffiliateRequest(userId);
    if (existing) {
      return res.status(409).json({ error: 'request_exists', status: existing.status });
    }
    
    const newRequest = await repo.createAffiliateRequest(userId, body.pitch || null, body.social_links || []);
    return res.status(201).json(newRequest);
  } catch (e) {
    next(e);
  }
}

export async function getReferralStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const status = await service.getUserReferralStatus(userId);
    return res.json(status);
  } catch (e) {
    next(e);
  }
}

export async function getReferralStats(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const stats = await service.getUserReferralStats(userId);
    return res.json(stats);
  } catch (e) {
    next(e);
  }
}
