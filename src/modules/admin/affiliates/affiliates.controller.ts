import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../../middlewares/auth.middleware.js';
import * as service from './affiliates.service.js';
import { createAffiliateSchema, updateAffiliateSchema } from './affiliates.validator.js';
import type { Affiliate } from './affiliates.repo.js';

function parseDateInput(input?: string | null): Date | null {
  if (!input) return null;
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

export async function listAffiliates(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const affiliates = await service.listAffiliates();
    res.json(affiliates);
  } catch (e) {
    next(e);
  }
}

export async function createAffiliate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = createAffiliateSchema.parse(req.body);
    const data: Omit<Affiliate, 'id' | 'rewards_awarded' | 'created_at' | 'updated_at'> = {
      ...input,
      starts_at: parseDateInput(input.starts_at),
      ends_at: parseDateInput(input.ends_at),
      owner_user_id: input.owner_user_id ?? null,
    };
    const affiliate = await service.createAffiliate(data);
    res.json(affiliate);
  } catch (e) {
    next(e);
  }
}

export async function updateAffiliate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const input = updateAffiliateSchema.parse(req.body);
    const data: Partial<Omit<Affiliate, 'id' | 'created_at'>> = {
      ...input,
      starts_at: input.starts_at !== undefined ? parseDateInput(input.starts_at) : undefined,
      ends_at: input.ends_at !== undefined ? parseDateInput(input.ends_at) : undefined,
    };
    const affiliate = await service.updateAffiliate(id, data);
    if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });
    res.json(affiliate);
  } catch (e) {
    next(e);
  }
}

export async function deleteAffiliate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    await service.deleteAffiliate(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

