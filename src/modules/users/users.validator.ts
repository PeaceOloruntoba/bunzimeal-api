import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  health: z.any().optional(),
  taste: z.any().optional(),
  preferences: z.any().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  country_id: z.coerce.number().int().nullable().optional(),
  age: z.coerce.number().int().nullable().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
  height_cm: z.coerce.number().int().nullable().optional(),
  weight_kg: z.coerce.number().int().nullable().optional(),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).nullable().optional(),
  health_goals: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  food_allergies: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  medical_dietary_restrictions: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  favorite_flavors: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  cuisine_preferences: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  heat_tolerance: z.enum(['mild', 'medium', 'hot', 'extra_hot']).nullable().optional(),
  texture_preference: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  foods_loved: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  foods_disliked: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  snack_personality: z.string().nullable().optional(),
  meal_prep_style: z.string().nullable().optional(),
  cooking_skill_level: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
  budget_level: z.enum(['low', 'medium', 'high']).nullable().optional(),
  meals_per_day: z.coerce.number().int().min(1).max(6).nullable().optional(),
  diet_type: z.string().nullable().optional(),
  household_size: z.string().nullable().optional(),
  shopping_frequency: z.string().nullable().optional(),
  kitchen_equipment_available: z.array(z.string()).or(z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      return val.split(',').map(s => s.trim());
    }
  })).nullable().optional(),
  leftovers_preference: z.string().nullable().optional(),
});

export const statsSummarySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'daily']).optional().default('today'),
});
