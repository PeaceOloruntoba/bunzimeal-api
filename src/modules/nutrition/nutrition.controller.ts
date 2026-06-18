import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './nutrition.service.js';
import * as healthEngagementRepo from '../health-engagement/health-engagement.repo.js';
import { nutritionCreateSchema, nutritionUpdateSchema, mealPlanSchema, recipeCreateSchema, recipeUpdateSchema } from './nutrition.validator.js';

// Nutrition
export async function listNutrition(req: Request, res: Response, next: NextFunction) {
  try {
    const recipeId = req.query.recipe_id ? Number(req.query.recipe_id) : undefined;
    const items = await service.listNutrition(recipeId);
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function getNutrition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const item = await service.getNutrition(id);
    if (!item) return res.status(404).json({ error: 'Not Found', errorMessage: 'Nutrition not found' });
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
}

export async function createNutrition(req: Request, res: Response, next: NextFunction) {
  try {
    const body = nutritionCreateSchema.parse(req.body);
    const created = await service.createNutrition(body);
    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (e) {
    next(e);
  }
}

export async function updateNutrition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const body = nutritionUpdateSchema.parse(req.body);
    const out = await service.updateNutrition(id, body);
    if (!out.updated) return res.status(400).json({ error: 'No updatable fields', errorMessage: 'Nothing to update' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteNutrition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    await service.softDeleteNutrition(id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

// Recipes
export async function listRecipes(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const perPage = req.query.per_page ? Number(req.query.per_page) : undefined;
    if (page && perPage) {
      const { items, total } = await service.listRecipesPaged(page, perPage);
      res.setHeader('X-Total-Count', String(total));
      return res.json({ success: true, data: items, total });
    }
    const items = await service.listRecipes();
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function getRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const item = await service.getRecipe(id);
    if (!item) return res.status(404).json({ error: 'Not Found', errorMessage: 'Recipe not found' });
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
}

export async function createRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    const body = recipeCreateSchema.parse(req.body);
    const created = await service.createRecipe(body);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
}

export async function updateRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const body = recipeUpdateSchema.parse(req.body);
    const out = await service.updateRecipe(id, body);
    if (!out.updated) return res.status(400).json({ error: 'No updatable fields', errorMessage: 'Nothing to update' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    await service.softDeleteRecipe(id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

// Meal Plans
export async function getMealPlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const plan = await service.getUserPlan(userId);
    res.json({ success: true, data: plan });
  } catch (e) {
    next(e);
  }
}

export async function replaceMealPlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const plan = mealPlanSchema.parse(req.body?.plan ?? req.body);
    const saved = await service.replaceUserPlan(userId, plan);
    res.json({ success: true, data: saved });
  } catch (e) {
    next(e);
  }
}

export async function clearMealPlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    await service.clearUserPlan(userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function validateMealPlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const plan = req.body?.plan ?? req.body;
    if (!plan) return res.status(400).json({ error: 'Plan required', errorMessage: 'Plan required in body' });
    const rules = await healthEngagementRepo.loadRulesForUser(userId);
    // For now, just return rules (actual validation logic can be added later)
    res.json({ success: true, data: { valid: true, rules } });
  } catch (e) {
    next(e);
  }
}
