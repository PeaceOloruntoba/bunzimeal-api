-- 0010_ai.sql

CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'hybrid',
  title TEXT NOT NULL DEFAULT 'My AI Assistant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  artifact_id UUID,
  token_usage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_user ON ai_artifacts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON ai_memories(user_id, kind);

CREATE TABLE IF NOT EXISTS goal_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_key TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_validation_rules_key ON goal_validation_rules(goal_key);

INSERT INTO goal_validation_rules (goal_key, rule_type, config, severity) VALUES
  ('vegan', 'forbidden_keyword', '{"keywords": ["chicken","beef","pork","fish","egg","milk","cheese","yogurt"], "substitutes": {"chicken": "tofu", "beef": "mushroom"}}'::jsonb, 'critical'),
  ('diabetes', 'max_nutrient_per_meal', '{"nutrient":"sugar_g","max":10}'::jsonb, 'critical'),
  ('low_sodium', 'forbidden_keyword', '{"keywords": ["salt","soy sauce","bouillon"], "substitutes": {"soy sauce": "low-sodium soy sauce"}}'::jsonb, 'warning'),
  ('vegetarian', 'forbidden_keyword', '{"keywords": ["beef","pork","chicken","fish","shrimp","gelatin"], "substitutes": {"chicken": "tofu", "beef": "mushroom"}}'::jsonb, 'critical'),
  ('keto', 'forbidden_keyword', '{"keywords": ["rice","pasta","bread","potato","yam","sugar","garri","eba","fufu"], "substitutes": {"rice":"cauliflower rice","pasta":"zucchini noodles"}}'::jsonb, 'warning'),
  ('halal', 'forbidden_keyword', '{"keywords": ["pork","bacon","ham","alcohol"], "substitutes": {"bacon":"beef bacon"}}'::jsonb, 'critical'),
  ('nut_allergy', 'forbidden_keyword', '{"keywords": ["peanut","almond","cashew","walnut","pecan","brazil nut","hazelnut"], "substitutes": {}}'::jsonb, 'critical'),
  ('low_sugar', 'max_nutrient_per_meal', '{"nutrient":"sugar_g","max":8}'::jsonb, 'critical'),
  ('pescatarian', 'forbidden_keyword', '{"keywords": ["beef","pork","chicken","lamb","goat"], "substitutes": {"chicken":"fish","beef":"fish"}}'::jsonb, 'warning');
