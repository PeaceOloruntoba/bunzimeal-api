import type { Request, Response, NextFunction } from 'express';
import * as repo from './localization.repo.js';

export async function listCountries(req: Request, res: Response, next: NextFunction) {
  try {
    const countries = await repo.listCountries();
    res.json(countries);
  } catch (e) {
    next(e);
  }
}
