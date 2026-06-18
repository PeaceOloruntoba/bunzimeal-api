import { z } from 'zod';

export const nutritionCreateSchema = z.object({
  recipe_id: z.number().int().positive(),
  calories: z.number().int().min(0).optional().default(0),
  protein_grams: z.number().min(0).optional().default(0),
  carbs_grams: z.number().min(0).optional().default(0),
  fat_grams: z.number().min(0).optional().default(0),
});

export const nutritionUpdateSchema = z.object({
  recipe_id: z.number().int().positive().optional(),
  calories: z.number().int().min(0).optional(),
  protein_grams: z.number().min(0).optional(),
  carbs_grams: z.number().min(0).optional(),
  fat_grams: z.number().min(0).optional(),
});

export const mealPlanSchema = z.any(); // Flexible for now

export const recipeCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  image_url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  nutrition: z.object({
    calories: z.number().int().min(0).optional(),
    protein_grams: z.number().min(0).optional(),
    carbs_grams: z.number().min(0).optional(),
    fat_grams: z.number().min(0).optional(),
  }).optional().nullable(),
});

export const recipeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  image_url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
});
