import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './pantry.service.js';
import { pantryItemCreateSchema, pantryItemUpdateSchema } from './pantry.validator.js';

export async function listPantry(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const items = await service.listPantry(userId);
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function getPantryItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    const item = await service.getPantryItem(userId, id);
    if (!item) return res.status(404).json({ error: 'Not Found', errorMessage: 'Pantry item not found' });
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
}

export async function createPantryItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = pantryItemCreateSchema.parse(req.body);
    const created = await service.createPantryItem(userId, body);
    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (e) {
    next(e);
  }
}

export async function updatePantryItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    const body = pantryItemUpdateSchema.parse(req.body);
    const out = await service.updatePantryItem(userId, id, body);
    if (!out.updated) return res.status(400).json({ error: 'No updatable fields', errorMessage: 'Nothing to update' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deletePantryItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    await service.softDeletePantryItem(userId, id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
