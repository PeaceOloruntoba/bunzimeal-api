import { Router } from 'express';
import * as controller from './nutrition.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

// Nutrition routes
router.route('/nutrition')
  .get(controller.listNutrition)
  .post(controller.createNutrition)
  .all(methodNotAllowed);

router.route('/nutrition/:id')
  .get(controller.getNutrition)
  .put(controller.updateNutrition)
  .delete(controller.deleteNutrition)
  .all(methodNotAllowed);

// Recipe routes
router.route('/recipes')
  .get(controller.listRecipes)
  .post(controller.createRecipe)
  .all(methodNotAllowed);

router.route('/recipes/:id')
  .get(controller.getRecipe)
  .put(controller.updateRecipe)
  .delete(controller.deleteRecipe)
  .all(methodNotAllowed);

// Meal Plan routes
router.route('/meal-plans')
  .get(requireAuth, controller.getMealPlan)
  .put(requireAuth, controller.replaceMealPlan)
  .delete(requireAuth, controller.clearMealPlan)
  .all(methodNotAllowed);

router.route('/meal-plans/validate')
  .post(requireAuth, controller.validateMealPlan)
  .all(methodNotAllowed);

export default router;
