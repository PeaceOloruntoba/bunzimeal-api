-- 0004_engagement.sql
-- Streaks, health logs, and perks

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_check_in_date DATE,
  total_check_ins INTEGER NOT NULL DEFAULT 0,
  streak_milestone_unlocked TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_current ON user_streaks(current_streak DESC);

CREATE TABLE IF NOT EXISTS health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  log_type TEXT NOT NULL CHECK (log_type IN ('weight', 'water', 'calories', 'protein', 'custom')),
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date, log_type)
);

CREATE INDEX IF NOT EXISTS idx_health_logs_user_date ON health_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_type ON health_logs(log_type);

CREATE TABLE IF NOT EXISTS user_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perk_code TEXT NOT NULL,
  perk_name TEXT NOT NULL,
  perk_type TEXT NOT NULL CHECK (perk_type IN ('streak_milestone', 'engagement_badge', 'community_reward', 'referral_bonus')),
  perk_value JSONB,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perks_user ON user_perks(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_perks_type ON user_perks(perk_type);
