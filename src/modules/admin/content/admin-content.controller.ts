import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../../middlewares/auth.middleware.js';
import * as service from './content.service.js';
import { updateContentsSchema, createFaqSchema, updateFaqSchema } from './content.validator.js';

export async function getContents(_req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const out = await service.getContents();
    return res.json(out || {});
  } catch (e) {
    next(e);
  }
}

export async function updateContents(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const body = updateContentsSchema.parse(req.body);
    const out = await service.updateContents(body);
    return res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function listFaqs(_req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const rows = await service.adminListFaqs();
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function createFaq(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { question, answer } = createFaqSchema.parse(req.body);
    const row = await service.createFaq(question, answer);
    return res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function updateFaq(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { question, answer } = updateFaqSchema.parse(req.body);
    const row = await service.updateFaq(id, question, answer);
    if (!row) return res.status(404).json({ error: 'FAQ not found' });
    return res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function deleteFaq(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    await service.softDeleteFaq(id);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

