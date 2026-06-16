-- 0009_affiliates_referrals.sql

DO $$ BEGIN
  CREATE TYPE referral_benefit AS ENUM ('percent_discount', 'trial_days');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  benefit referral_benefit NOT NULL DEFAULT 'percent_discount',
  benefit_value INTEGER NOT NULL DEFAULT 50,
  cap INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  benefit referral_benefit NOT NULL,
  benefit_value INTEGER NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_affiliate ON referral_redemptions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_active ON affiliates(active);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_referred_by_affiliate_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_referred_by_affiliate_fkey
  FOREIGN KEY (referred_by_affiliate) REFERENCES affiliates(id) ON DELETE SET NULL;

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_affiliate_id_fkey;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL;
