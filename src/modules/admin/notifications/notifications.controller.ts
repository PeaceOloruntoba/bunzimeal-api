import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../../middlewares/auth.middleware.js';
import * as service from './notifications.service.js';
import { createNewsletterSchema, previewNewsletterSchema } from './notifications.validator.js';

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = createNewsletterSchema.parse(req.body);
    const result = await service.createAndSendAsync(input);
    res.status(202).json(result);
  } catch (e) {
    next(e);
  }
}

export async function list(_req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const rows = await service.listNewsletters(50);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function getById(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const row = await service.getNewsletterById(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function preview(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { body_html, user_id } = previewNewsletterSchema.parse(req.body);
    const html = await service.renderPreview(body_html, user_id);
    res.json({ html });
  } catch (e) {
    next(e);
  }
}

