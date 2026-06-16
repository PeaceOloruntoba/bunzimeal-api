-- 0002_user_profiles.sql
-- Profiles and normalized user preferences

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio TEXT,

  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm INTEGER,
  weight_kg INTEGER,
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  health_goals TEXT[],
  food_allergies TEXT[],
  medical_dietary_restrictions TEXT[],

  favorite_flavors TEXT[],
  cuisine_preferences TEXT[],
  heat_tolerance TEXT CHECK (heat_tolerance IN ('mild', 'medium', 'hot', 'extra_hot')),
  texture_preference TEXT[],
  foods_loved TEXT[],
  foods_disliked TEXT[],
  snack_personality TEXT,

  meal_prep_style TEXT,
  cooking_skill_level TEXT CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced')),
  budget_level TEXT CHECK (budget_level IN ('low', 'medium', 'high')),
  meals_per_day INTEGER CHECK (meals_per_day BETWEEN 1 AND 6),
  diet_type TEXT,
  household_size TEXT,
  shopping_frequency TEXT,
  kitchen_equipment_available TEXT[],
  leftovers_preference TEXT,

  health JSONB,
  taste JSONB,
  preferences JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  diet_type TEXT,
  allergens TEXT[],
  disliked_ingredients TEXT[],
  liked_cuisines TEXT[],
  macro_calories INTEGER,
  macro_protein_g INTEGER,
  macro_carbs_g INTEGER,
  macro_fat_g INTEGER,
  preferred_prep_minutes INTEGER,
  budget_per_week NUMERIC(10, 2),
  budget_per_meal NUMERIC(10, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
