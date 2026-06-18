import * as repo from './nutrition.repo.js';

// Nutrition
export const listNutrition = repo.listNutrition;
export const getNutrition = repo.getNutrition;
export const getNutritionByRecipeId = repo.getNutritionByRecipeId;
export const getNutritionByRecipeIds = repo.getNutritionByRecipeIds;
export const createNutrition = repo.createNutrition;
export const updateNutrition = repo.updateNutrition;
export const softDeleteNutrition = repo.softDeleteNutrition;

// Recipes
export const listRecipes = repo.listRecipes;
export const getRecipe = repo.getRecipe;
export const createRecipe = repo.createRecipe;
export const updateRecipe = repo.updateRecipe;
export const softDeleteRecipe = repo.softDeleteRecipe;
export const listRecipesPaged = repo.listRecipesPaged;

// Meal Plans
export const getUserPlan = repo.getUserPlan;
export const replaceUserPlan = repo.replaceUserPlan;
export const clearUserPlan = repo.clearUserPlan;
