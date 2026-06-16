-- 0006_nutrition.sql

CREATE TABLE IF NOT EXISTS nutrition (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_grams NUMERIC(8, 2) NOT NULL DEFAULT 0,
  carbs_grams NUMERIC(8, 2) NOT NULL DEFAULT 0,
  fat_grams NUMERIC(8, 2) NOT NULL DEFAULT 0,
  fiber_grams NUMERIC(8, 2),
  sugar_grams NUMERIC(8, 2),
  sodium_mg INTEGER,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_recipe ON nutrition(recipe_id) WHERE deleted_at IS NULL;
