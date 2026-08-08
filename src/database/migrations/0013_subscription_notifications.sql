-- 0013_subscription_notifications.sql
-- Durable in-app notifications and idempotent subscription expiry reminders

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  milestone_days INTEGER NOT NULL CHECK (milestone_days IN (90, 60, 30, 7)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscription_id, milestone_days)
);

UPDATE user_subscriptions
SET auto_renew = false,
    status = CASE
      WHEN status IN ('active'::subscription_status, 'trialing'::subscription_status)
       AND COALESCE(current_period_end, trial_end) <= NOW()
      THEN 'expired'::subscription_status
      ELSE status
    END,
    updated_at = NOW()
WHERE auto_renew = true
   OR (status IN ('active'::subscription_status, 'trialing'::subscription_status)
       AND COALESCE(current_period_end, trial_end) <= NOW());