-- 0012_health_metrics_expand.sql
-- Expand health log types, add daily check-ins, add health recommendations cache

-- Expand health_logs log_type to include more interactive metrics
ALTER TABLE health_logs DROP CONSTRAINT IF EXISTS health_logs_log_type_check;

ALTER TABLE health_logs ADD CONSTRAINT health_logs_log_type_check CHECK (
  log_type IN (
    'weight', 'water', 'calories', 'protein',
    'sleep', 'steps', 'exercise', 'fat', 'carbs',
    'systolic_bp', 'diastolic_bp', 'heart_rate',
    'mood', 'energy', 'custom'
  )
);

-- Daily check-ins table for richer engagement (mood, energy, how the day felt)
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  hunger INTEGER CHECK (hunger BETWEEN 1 AND 5),
  cravings TEXT,
  symptoms TEXT,
  bowel_movement BOOLEAN DEFAULT FALSE,
  water_cups INTEGER CHECK (water_cups >= 0) DEFAULT 0,
  steps_count INTEGER CHECK (steps_count >= 0) DEFAULT 0,
  exercise_minutes INTEGER CHECK (exercise_minutes >= 0) DEFAULT 0,
  sleep_hours NUMERIC(4,2) CHECK (sleep_hours >= 0),
  weight NUMERIC(8,2),
  journal TEXT,
  gratitude TEXT[],
  ai_tip TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);

-- Health recommendations / AI insights cache
CREATE TABLE IF NOT EXISTS health_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('daily_tip', 'weekly_summary', 'milestone_advice', 'warning', 'encouragement')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  related_log_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_recs_user_unread ON health_recommendations(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_recs_user_date ON health_recommendations(user_id, generated_at DESC);
