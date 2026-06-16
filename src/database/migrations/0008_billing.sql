-- 0008_billing.sql
-- Subscription settings, billing plans, user subscriptions, and payments

CREATE TABLE IF NOT EXISTS subscription_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  trial_days INTEGER NOT NULL DEFAULT 7,
  founder_discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  founder_window_starts_at TIMESTAMPTZ,
  founder_window_ends_at TIMESTAMPTZ,
  founder_capacity INTEGER NOT NULL DEFAULT 100,
  founder_discount_pct INTEGER NOT NULL DEFAULT 50,
  founder_awarded_count INTEGER NOT NULL DEFAULT 0,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_quarterly_cents INTEGER NOT NULL DEFAULT 0,
  price_biannual_cents INTEGER NOT NULL DEFAULT 0,
  price_annual_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_plans (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_quarterly_cents INTEGER NOT NULL DEFAULT 0,
  price_biannual_cents INTEGER NOT NULL DEFAULT 0,
  price_annual_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_country ON billing_plans(country_id);

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('monthly', 'quarterly', 'biannual', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('none', 'trialing', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'none',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  gateway TEXT NOT NULL DEFAULT 'paystack',
  gateway_customer_id TEXT,
  gateway_subscription_code TEXT,
  gateway_reference TEXT,
  amount_cents INTEGER,
  currency TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  authorization_code TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  renew_failed_count INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  affiliate_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  gateway TEXT NOT NULL DEFAULT 'paystack',
  gateway_payment_id TEXT,
  reference TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  failure_code TEXT,
  failure_message TEXT,
  receipt_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
