import { query } from '../../db/pool.js';

export interface Nutrition {
  id: number;
  recipe_id: number;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Recipe {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  description: string | null;
  details: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserMealPlan {
  id: string;
  user_id: string;
  plan: any;
  created_at: Date;
  updated_at: Date;
}

// Nutrition
export async function listNutrition(recipeId?: number) {
  if (recipeId) {
    const { rows } = await query<Nutrition>('SELECT * FROM nutrition WHERE recipe_id=$1 AND deleted_at IS NULL ORDER BY id ASC', [recipeId]);
    return rows;
  }
  const { rows } = await query<Nutrition>('SELECT * FROM nutrition WHERE deleted_at IS NULL ORDER BY id ASC');
  return rows;
}

export async function getNutrition(id: number) {
  const { rows } = await query<Nutrition>('SELECT * FROM nutrition WHERE id=$1 AND deleted_at IS NULL', [id]);
  return rows[0] || null;
}

export async function getNutritionByRecipeId(recipeId: number) {
  const { rows } = await query<Nutrition>('SELECT * FROM nutrition WHERE recipe_id=$1 AND deleted_at IS NULL', [recipeId]);
  return rows[0] || null;
}

export async function getNutritionByRecipeIds(recipeIds: number[]): Promise<Record<number, { calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }>> {
  if (!recipeIds.length) return {};
  const unique = Array.from(new Set(recipeIds));
  const { rows } = await query<{ recipe_id: number; calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }>(
    'SELECT recipe_id, calories, protein_grams, carbs_grams, fat_grams FROM nutrition WHERE deleted_at IS NULL AND recipe_id = ANY($1::int[])',
    [unique]
  );
  const map: Record<number, { calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }> = {};
  for (const r of rows) {
    const cur = map[r.recipe_id] || { calories: 0, protein_grams: 0, carbs_grams: 0, fat_grams: 0 };
    const cal = Number(r.calories) || 0;
    const protein = Number(r.protein_grams) || 0;
    const carbs = Number(r.carbs_grams) || 0;
    const fat = Number(r.fat_grams) || 0;
    cur.calories = Number(cur.calories || 0) + cal;
    cur.protein_grams = Number(cur.protein_grams || 0) + protein;
    cur.carbs_grams = Number(cur.carbs_grams || 0) + carbs;
    cur.fat_grams = Number(cur.fat_grams || 0) + fat;
    map[r.recipe_id] = cur;
  }
  return map;
}

export async function createNutrition(data: Omit<Nutrition, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
  const { rows } = await query<{ id: number }>(
    'INSERT INTO nutrition(recipe_id, calories, protein_grams, carbs_grams, fat_grams) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [data.recipe_id, data.calories, data.protein_grams, data.carbs_grams, data.fat_grams]
  );
  return rows[0];
}

export async function updateNutrition(id: number, data: Partial<Omit<Nutrition, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  const allow = new Set(['recipe_id', 'calories', 'protein_grams', 'carbs_grams', 'fat_grams']);
  for (const [k, v] of Object.entries(data)) {
    if (allow.has(k)) {
      fields.push(`${k}=$${i++}`);
      params.push(v);
    }
  }
  if (!fields.length) return { updated: false } as const;
  params.push(id);
  await query(`UPDATE nutrition SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i}`, [...params]);
  return { updated: true } as const;
}

export async function softDeleteNutrition(id: number) {
  await query('UPDATE nutrition SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL', [id]);
  return { deleted: true } as const;
}

// Recipes
export async function listRecipes() {
  const { rows } = await query<Recipe & { calories: number | null }>(
    `SELECT r.id, r.name, r.category, r.image_url, r.description, r.details,
            COALESCE(n.calories, 0) AS calories
     FROM recipes r
     LEFT JOIN nutrition n ON n.recipe_id = r.id AND n.deleted_at IS NULL
     WHERE r.deleted_at IS NULL
     ORDER BY r.id ASC`
  );
  return rows;
}

export async function getRecipe(id: number) {
  const { rows } = await query<Recipe & { full_nutrition: any }>(
    `SELECT r.id, r.name, r.category, r.image_url, r.description, r.details,
            row_to_json(n) AS full_nutrition
     FROM recipes r
     LEFT JOIN nutrition n ON r.id = n.recipe_id
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

export async function createRecipe(data: {
  name: string;
  category: string;
  image_url?: string | null;
  description?: string | null;
  details?: string | null;
  nutrition?: { calories?: number; protein_grams?: number; carbs_grams?: number; fat_grams?: number } | null;
}) {
  await query('BEGIN');
  try {
    const nextIdRes = await query<{ next_id: number }>(
      `WITH max_id AS (
         SELECT COALESCE(MAX(id), 0) AS max_id FROM recipes
       ),
       candidate AS (
         SELECT i AS id
         FROM generate_series(1, (SELECT max_id + 1 FROM max_id)) AS gs(i)
         EXCEPT
         SELECT id FROM recipes
         ORDER BY id
         LIMIT 1
       )
       SELECT COALESCE((SELECT id FROM candidate), (SELECT max_id + 1 FROM max_id)) AS next_id`
    );
    const nextId = nextIdRes.rows[0].next_id;

    const { rows } = await query<{ id: number; name: string }>(
      'INSERT INTO recipes(id, name, category, image_url, description, details) VALUES($1,$2,$3,$4,$5,$6) RETURNING id, name',
      [nextId, data.name, data.category, data.image_url ?? null, data.description ?? null, data.details ?? null]
    );
    const rec = rows[0];
    const n = data.nutrition || null;
    if (n && (n.calories !== undefined || n.protein_grams !== undefined || n.carbs_grams !== undefined || n.fat_grams !== undefined)) {
      await query(
        `INSERT INTO nutrition(recipe_id, calories, protein_grams, carbs_grams, fat_grams)
         VALUES($1,$2,$3,$4,$5)`,
        [rec.id, n.calories ?? 0, n.protein_grams ?? 0, n.carbs_grams ?? 0, n.fat_grams ?? 0]
      );
    }
    await query(`SELECT setval(pg_get_serial_sequence('recipes','id'), (SELECT MAX(id) FROM recipes), true)`);
    await query('COMMIT');
    return rec;
  } catch (e) {
    await query('ROLLBACK');
    throw e;
  }
}

export async function updateRecipe(id: number, data: Partial<Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (data.name !== undefined) { fields.push(`name=$${i++}`); params.push(data.name); }
  if (data.category !== undefined) { fields.push(`category=$${i++}`); params.push(data.category); }
  if (data.image_url !== undefined) { fields.push(`image_url=$${i++}`); params.push(data.image_url); }
  if (data.description !== undefined) { fields.push(`description=$${i++}`); params.push(data.description); }
  if (data.details !== undefined) { fields.push(`details=$${i++}`); params.push(data.details); }

  if (!fields.length) return { updated: false } as const;
  params.push(id);
  await query(`UPDATE recipes SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i}`, [...params]);
  return { updated: true } as const;
}

export async function softDeleteRecipe(id: number) {
  await query('UPDATE recipes SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL', [id]);
  return { deleted: true } as const;
}

export async function listRecipesPaged(page: number, perPage: number) {
  const p = Math.max(1, Number(page || 1));
  const lim = Math.max(1, Math.min(100, Number(perPage || 20)));
  const off = (p - 1) * lim;
  const { rows: items } = await query<Recipe & { calories: number | null }>(
    `SELECT r.id, r.name, r.category, r.image_url, COALESCE(n.calories, 0) AS calories
     FROM recipes r
     LEFT JOIN nutrition n ON n.recipe_id = r.id AND n.deleted_at IS NULL
     WHERE r.deleted_at IS NULL
     ORDER BY r.id ASC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM recipes r WHERE r.deleted_at IS NULL`
  );
  return { items, total: Number(count) };
}

// Meal Plans
export async function getUserPlan(userId: string) {
  const { rows } = await query<UserMealPlan>('SELECT * FROM user_meal_plans WHERE user_id=$1', [userId]);
  return rows[0]?.plan ?? {};
}

export async function replaceUserPlan(userId: string, plan: any) {
  await query(
    `INSERT INTO user_meal_plans(user_id, plan, updated_at)
     VALUES($1,$2,NOW())
     ON CONFLICT (user_id) DO UPDATE SET plan=EXCLUDED.plan, updated_at=EXCLUDED.updated_at`,
    [userId, plan]
  );
  return plan;
}

export async function clearUserPlan(userId: string) {
  await query('DELETE FROM user_meal_plans WHERE user_id=$1', [userId]);
  return { ok: true } as const;
}
