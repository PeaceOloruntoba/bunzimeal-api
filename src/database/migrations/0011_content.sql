-- 0011_content.sql
-- Newsletters, FAQs, and site contents

CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  is_admin_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_created ON newsletters(created_at DESC);

CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_faqs_deleted ON faqs(deleted_at);

CREATE TABLE IF NOT EXISTS site_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_policy TEXT,
  terms_and_condition TEXT,
  refund_policy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_contents (id, privacy_policy, terms_and_condition, refund_policy)
SELECT gen_random_uuid(), '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM site_contents);
