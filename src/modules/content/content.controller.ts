import type { Request, Response, NextFunction } from 'express';
import * as service from '../admin/content/content.service.js';

export async function publicGetContents(_req: Request, res: Response, next: NextFunction) {
  try {
    const out = await service.getContents();
    return res.json(out || {});
  } catch (e) {
    next(e);
  }
}

export async function publicListFaqs(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await service.listPublicFaqs();
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

