import { query } from '../../db/pool.js';

export interface Country {
  id: number;
  name: string;
  code: string;
  currency: string;
}

export interface UserBasic {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'admin';
  country: Country | null;
}

export interface Profile {
  id: string;
  user_id: string;
  avatar_url: string | null;
  bio: string | null;
  health: any | null;
  taste: any | null;
  preferences: any | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  health_goals: string[] | null;
  food_allergies: string[] | null;
  medical_dietary_restrictions: string[] | null;
  favorite_flavors: string[] | null;
  cuisine_preferences: string[] | null;
  heat_tolerance: string | null;
  texture_preference: string[] | null;
  foods_loved: string[] | null;
  foods_disliked: string[] | null;
  snack_personality: string | null;
  meal_prep_style: string | null;
  cooking_skill_level: string | null;
  budget_level: string | null;
  meals_per_day: number | null;
  diet_type: string | null;
  household_size: string | null;
  shopping_frequency: string | null;
  kitchen_equipment_available: string[] | null;
  leftovers_preference: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Nutrition {
  id: number;
  recipe_id: number;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
}

export type MacroTotals = { calories: number; protein_grams: number; carbs_grams: number; fat_grams: number };

export interface UserStat {
  id: number;
  user_id: string;
  stat_date: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
}

export async function getUserBasic(userId: string): Promise<UserBasic | null> {
  const { rows } = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
    country_id: number | null;
    country_name: string | null;
    country_code: string | null;
    country_currency: string | null;
  }>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
      c.id AS country_id, c.name AS country_name, c.code AS country_code, c.currency AS country_currency
     FROM users u LEFT JOIN countries c ON u.country_id = c.id WHERE u.id=$1`,
    [userId]
  );
  const r = rows[0];
  if (!r) return null;
  const country = r.country_id ? { id: r.country_id, name: r.country_name as string, code: r.country_code as string, currency: r.country_currency as string } : null;
  return { id: r.id, email: r.email, first_name: r.first_name, last_name: r.last_name, role: r.role as 'user' | 'admin', country };
}

export async function updateUserBasic(userId: string, data: { first_name?: string | null; last_name?: string | null; country_id?: number | null }) {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  if (data.first_name !== undefined) {
    sets.push(`first_name=$${i++}`);
    params.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    sets.push(`last_name=$${i++}`);
    params.push(data.last_name);
  }
  if (data.country_id !== undefined) {
    sets.push(`country_id=$${i++}`);
    params.push(data.country_id);
  }
  
  if (!sets.length) return getUserBasic(userId);
  
  params.push(userId);
  await query(`UPDATE users SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${i}`, params);
  return getUserBasic(userId);
}

export async function getProfile(userId: string) {
  const { rows } = await query<Profile>('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  return rows[0] || null;
}

export async function upsertProfile(userId: string, patch: Record<string, any>) {
  await query('INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  const keys = Object.keys(patch);
  if (!keys.length) return getProfile(userId);
  
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    params.push(patch[k]);
  }
  
  params.push(userId);
  await query(`UPDATE profiles SET ${sets.join(', ')}, updated_at=NOW() WHERE user_id=$${i}`, params);
  return getProfile(userId);
}

export async function getCountryById(countryId: number) {
  const { rows } = await query<Country>('SELECT * FROM countries WHERE id=$1', [countryId]);
  return rows[0] || null;
}

export async function getNutritionByRecipeIds(recipeIds: number[]): Promise<Record<number, MacroTotals>> {
  if (!recipeIds.length) return {};
  const unique = Array.from(new Set(recipeIds));
  const { rows } = await query<{ recipe_id: number; calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }>(
    'SELECT recipe_id, calories, protein_grams, carbs_grams, fat_grams FROM nutrition WHERE deleted_at IS NULL AND recipe_id = ANY($1::int[])',
    [unique]
  );
  const map: Record<number, MacroTotals> = {};
  for (const r of rows) {
    const cur = map[r.recipe_id] || { calories: 0, protein_grams: 0, carbs_grams: 0, fat_grams: 0 };
    cur.calories += Number(r.calories) || 0;
    cur.protein_grams += Number(r.protein_grams) || 0;
    cur.carbs_grams += Number(r.carbs_grams) || 0;
    cur.fat_grams += Number(r.fat_grams) || 0;
    map[r.recipe_id] = cur;
  }
  return map;
}

export async function getUserMealPlan(userId: string): Promise<any> {
  const { rows } = await query<{ plan: any }>('SELECT plan FROM user_meal_plans WHERE user_id=$1', [userId]);
  return rows[0]?.plan || {};
}

export async function listStats(userId: string, from?: string, to?: string) {
  if (from && to) {
    const { rows } = await query<UserStat>('SELECT * FROM user_stats WHERE user_id=$1 AND deleted_at IS NULL AND stat_date BETWEEN $2 AND $3 ORDER BY stat_date ASC', [userId, from, to]);
    return rows;
  }
  const { rows } = await query<UserStat>('SELECT * FROM user_stats WHERE user_id=$1 AND deleted_at IS NULL ORDER BY stat_date DESC', [userId]);
  return rows;
}

export async function getStat(userId: string, id: number) {
  const { rows } = await query<UserStat>('SELECT * FROM user_stats WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, userId]);
  return rows[0] || null;
}

export async function upsertStat(userId: string, data: Omit<UserStat, 'id' | 'user_id'>) {
  const { rows } = await query<{ id: number }>(
    `INSERT INTO user_stats(user_id, stat_date, calories, protein_grams, carbs_grams, fat_grams)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, stat_date)
     DO UPDATE SET calories=EXCLUDED.calories, protein_grams=EXCLUDED.protein_grams, carbs_grams=EXCLUDED.carbs_grams, fat_grams=EXCLUDED.fat_grams, updated_at=NOW()
     RETURNING id`,
    [userId, data.stat_date, data.calories, data.protein_grams, data.carbs_grams, data.fat_grams]
  );
  return rows[0];
}

export async function updateStat(userId: string, id: number, data: Partial<Omit<UserStat, 'id' | 'user_id'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  for (const [k, v] of Object.entries(data)) {
    fields.push(`${k}=$${i++}`);
    params.push(v);
  }
  
  if (!fields.length) return { updated: false } as const;
  
  params.push(id, userId);
  await query(`UPDATE user_stats SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i++} AND user_id=$${i}`, params);
  return { updated: true } as const;
}

export async function softDeleteStat(userId: string, id: number) {
  await query('UPDATE user_stats SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, userId]);
  return { deleted: true } as const;
}
