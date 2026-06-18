import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as repo from './users.repo.js';
import * as service from './users.service.js';
import { updateProfileSchema, statsSummarySchema } from './users.validator.js';

export async function getProfile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const user = await repo.getUserBasic(userId);
    const profile = await repo.getProfile(userId);
    
    return res.json({ success: true, message: 'Profile retrieved', data: { user, profile } });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const body = updateProfileSchema.parse(req.body);
    const patch: Record<string, any> = {};
    
    if (body.bio !== undefined) patch.bio = body.bio;
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url;
    if (body.health !== undefined) patch.health = body.health;
    if (body.taste !== undefined) patch.taste = body.taste;
    if (body.preferences !== undefined) patch.preferences = body.preferences;
    if (body.age !== undefined) patch.age = body.age;
    if (body.gender !== undefined) patch.gender = body.gender;
    if (body.height_cm !== undefined) patch.height_cm = body.height_cm;
    if (body.weight_kg !== undefined) patch.weight_kg = body.weight_kg;
    if (body.activity_level !== undefined) patch.activity_level = body.activity_level;
    if (body.health_goals !== undefined) patch.health_goals = body.health_goals;
    if (body.food_allergies !== undefined) patch.food_allergies = body.food_allergies;
    if (body.medical_dietary_restrictions !== undefined) patch.medical_dietary_restrictions = body.medical_dietary_restrictions;
    if (body.favorite_flavors !== undefined) patch.favorite_flavors = body.favorite_flavors;
    if (body.cuisine_preferences !== undefined) patch.cuisine_preferences = body.cuisine_preferences;
    if (body.heat_tolerance !== undefined) patch.heat_tolerance = body.heat_tolerance;
    if (body.texture_preference !== undefined) patch.texture_preference = body.texture_preference;
    if (body.foods_loved !== undefined) patch.foods_loved = body.foods_loved;
    if (body.foods_disliked !== undefined) patch.foods_disliked = body.foods_disliked;
    if (body.snack_personality !== undefined) patch.snack_personality = body.snack_personality;
    if (body.meal_prep_style !== undefined) patch.meal_prep_style = body.meal_prep_style;
    if (body.cooking_skill_level !== undefined) patch.cooking_skill_level = body.cooking_skill_level;
    if (body.budget_level !== undefined) patch.budget_level = body.budget_level;
    if (body.meals_per_day !== undefined) patch.meals_per_day = body.meals_per_day;
    if (body.diet_type !== undefined) patch.diet_type = body.diet_type;
    if (body.household_size !== undefined) patch.household_size = body.household_size;
    if (body.shopping_frequency !== undefined) patch.shopping_frequency = body.shopping_frequency;
    if (body.kitchen_equipment_available !== undefined) patch.kitchen_equipment_available = body.kitchen_equipment_available;
    if (body.leftovers_preference !== undefined) patch.leftovers_preference = body.leftovers_preference;
    
    const userPatch: { first_name?: string | null; last_name?: string | null; country_id?: number | null } = {};
    if (body.first_name !== undefined) userPatch.first_name = body.first_name;
    if (body.last_name !== undefined) userPatch.last_name = body.last_name;
    if (body.country_id !== undefined) {
      if (body.country_id !== null) {
        const exists = await repo.getCountryById(body.country_id);
        if (!exists) return res.status(400).json({ error: 'Invalid country', errorMessage: 'Unknown country_id' });
      }
      userPatch.country_id = body.country_id;
    }
    
    const profile = await repo.upsertProfile(userId, patch);
    let user;
    if (Object.keys(userPatch).length > 0) {
      user = await repo.updateUserBasic(userId, userPatch);
    } else {
      user = await repo.getUserBasic(userId);
    }
    
    return res.json({ success: true, message: 'Profile updated', data: { user, profile } });
  } catch (e) {
    next(e);
  }
}

export async function statsSummary(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const query = statsSummarySchema.parse(req.query);
    let period = query.period;
    if (period === 'daily') period = 'today';
    
    const finalPeriod: service.SummaryPeriod = period as service.SummaryPeriod;
    
    if (!['today', 'week', 'month'].includes(finalPeriod)) {
      return res.status(400).json({ error: 'Invalid period', errorMessage: 'Choose daily, week or month' });
    }
    
    const summary = await service.computeStatsSummary(userId, finalPeriod);
    return res.json({ success: true, message: 'Stats summary retrieved', data: summary });
  } catch (e) {
    next(e);
  }
}
