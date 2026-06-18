import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './shopping-list.service.js';
import { shoppingItemCreateSchema, shoppingItemUpdateSchema } from './shopping-list.validator.js';

export async function listShopping(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const items = await service.listShopping(userId);
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function getShoppingItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    const item = await service.getShoppingItem(userId, id);
    if (!item) return res.status(404).json({ error: 'Not Found', errorMessage: 'Shopping item not found' });
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
}

export async function createShoppingItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = shoppingItemCreateSchema.parse(req.body);
    const created = await service.createShoppingItem(userId, body);
    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (e) {
    next(e);
  }
}

export async function updateShoppingItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    const body = shoppingItemUpdateSchema.parse(req.body);
    const out = await service.updateShoppingItem(userId, id, body);
    if (!out.updated) return res.status(400).json({ error: 'No updatable fields', errorMessage: 'Nothing to update' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteShoppingItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = Number(req.params.id);
    await service.softDeleteShoppingItem(userId, id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
