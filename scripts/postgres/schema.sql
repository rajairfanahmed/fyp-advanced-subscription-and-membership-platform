-- Advanced Subscription & Membership Platform: MongoDB -> PostgreSQL target schema
-- Apply to database: AdvancedSubscription_MembershipPlatform

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ENUM types ──────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('subscriber', 'creator'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE access_level AS ENUM ('free', 'basic', 'premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE profile_status AS ENUM ('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE content_publish_status AS ENUM ('draft', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE content_type AS ENUM ('video', 'article', 'file'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE video_provider AS ENUM ('upload', 'external'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE file_subtype AS ENUM ('pdf', 'zip', 'rar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE billing_cycle AS ENUM ('monthly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE platform_billing_cycle AS ENUM ('monthly', 'annually'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_category AS ENUM ('renewal', 'payment', 'content', 'account', 'locked', 'creator', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contact_status AS ENUM ('new', 'in_progress', 'resolved', 'spam'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE platform_default_subscriber_tier AS ENUM ('free', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE platform_default_creator_status AS ENUM ('review', 'active'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE platform_currency AS ENUM ('usd', 'eur', 'gbp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE platform_failure_cadence AS ENUM ('immediate', 'daily'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Quarantine (never silently drop unlinkable rows) ────────────────────────
CREATE TABLE IF NOT EXISTS migration_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_name TEXT NOT NULL,
  legacy_mongo_id CHAR(24),
  reason TEXT NOT NULL,
  raw_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migration_quarantine_collection
  ON migration_quarantine (collection_name, created_at DESC);

-- ── Core identity ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  clerk_user_id VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'subscriber',
  account_status account_status NOT NULL DEFAULT 'active',
  avatar_url TEXT NOT NULL DEFAULT '',
  avatar_key TEXT NOT NULL DEFAULT '',
  last_login_at TIMESTAMPTZ NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);

CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  user_profile_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  creator_slug VARCHAR(120) NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  avatar_key TEXT NOT NULL DEFAULT '',
  banner_url TEXT NOT NULL DEFAULT '',
  banner_key TEXT NOT NULL DEFAULT '',
  subscriber_count BIGINT NOT NULL DEFAULT 0,
  content_count BIGINT NOT NULL DEFAULT 0,
  total_views BIGINT NOT NULL DEFAULT 0,
  profile_status profile_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_workspace_alerts (
  creator_profile_id UUID PRIMARY KEY REFERENCES creator_profiles(id) ON DELETE CASCADE,
  new_subscriber BOOLEAN NOT NULL DEFAULT true,
  renewal_summary BOOLEAN NOT NULL DEFAULT true,
  failed_payment BOOLEAN NOT NULL DEFAULT false,
  engagement_report BOOLEAN NOT NULL DEFAULT true,
  weekly_revenue BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS creator_workspace_defaults (
  creator_profile_id UUID PRIMARY KEY REFERENCES creator_profiles(id) ON DELETE CASCADE,
  default_required_plan access_level NOT NULL DEFAULT 'basic',
  default_status content_publish_status NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS subscriber_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  user_profile_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  current_plan_label TEXT NOT NULL DEFAULT 'Free preview',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriber_notification_preferences (
  subscriber_profile_id UUID PRIMARY KEY REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  product_updates BOOLEAN NOT NULL DEFAULT true,
  content_digests BOOLEAN NOT NULL DEFAULT true,
  download_alerts BOOLEAN NOT NULL DEFAULT true,
  renewal_reminders BOOLEAN NOT NULL DEFAULT true,
  payment_alerts BOOLEAN NOT NULL DEFAULT true,
  account_notices BOOLEAN NOT NULL DEFAULT true,
  creator_announcements BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS subscriber_preferred_content_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_profile_id UUID NOT NULL REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  content_type VARCHAR(32) NOT NULL,
  UNIQUE (subscriber_profile_id, content_type)
);

-- ── Catalog ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  creator_profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  access_level access_level NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stripe_price_id VARCHAR(255) NULL,
  stripe_product_id VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (creator_profile_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_plans_creator_access ON plans (creator_profile_id, access_level);
CREATE INDEX IF NOT EXISTS idx_plans_creator_sort ON plans (creator_profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price ON plans (stripe_price_id);

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  creator_profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content_type content_type NOT NULL,
  required_plan access_level NOT NULL DEFAULT 'free',
  status content_publish_status NOT NULL DEFAULT 'draft',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  thumbnail_key TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NULL,
  views_count BIGINT NOT NULL DEFAULT 0,
  downloads_count BIGINT NOT NULL DEFAULT 0,
  watch_percent_sum NUMERIC(14, 4) NOT NULL DEFAULT 0,
  watch_events_count BIGINT NOT NULL DEFAULT 0,
  video_url TEXT NOT NULL DEFAULT '',
  video_key TEXT NOT NULL DEFAULT '',
  video_duration_label TEXT NOT NULL DEFAULT '',
  video_provider video_provider NOT NULL DEFAULT 'upload',
  external_video_url TEXT NOT NULL DEFAULT '',
  article_body TEXT NOT NULL DEFAULT '',
  article_summary TEXT NOT NULL DEFAULT '',
  file_subtype file_subtype NULL,
  file_url TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  file_size_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (creator_profile_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_status_created ON content (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_type ON content (content_type);
CREATE INDEX IF NOT EXISTS idx_content_required_plan ON content (required_plan);

-- ── Billing ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  subscriber_profile_id UUID NOT NULL REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  creator_profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  plan_id UUID NULL REFERENCES plans(id) ON DELETE SET NULL,
  access_level access_level NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  quota_period_start TIMESTAMPTZ NULL,
  monthly_download_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (subscriber_profile_id, creator_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_status
  ON subscriptions (creator_profile_id, status, access_level);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions (plan_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  subscriber_profile_id UUID NOT NULL REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  creator_profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  subscription_id UUID NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NULL REFERENCES plans(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status payment_status NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stripe_payment_intent_id VARCHAR(255) NULL,
  stripe_charge_id VARCHAR(255) NULL,
  stripe_invoice_id VARCHAR(255) NULL,
  receipt_url TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_creator_paid ON payments (creator_profile_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_subscriber_paid ON payments (subscriber_profile_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- ── Inbox / analytics / support / settings ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  recipient_user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  category notification_category NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_user_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications (recipient_user_profile_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications (category);

CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  creator_profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_subscribers BIGINT NOT NULL DEFAULT 0,
  active_subscribers BIGINT NOT NULL DEFAULT 0,
  paid_subscribers BIGINT NOT NULL DEFAULT 0,
  total_revenue_cents BIGINT NOT NULL DEFAULT 0,
  monthly_recurring_cents BIGINT NOT NULL DEFAULT 0,
  total_views BIGINT NOT NULL DEFAULT 0,
  total_downloads BIGINT NOT NULL DEFAULT 0,
  content_count BIGINT NOT NULL DEFAULT 0,
  new_subscribers_today BIGINT NOT NULL DEFAULT 0,
  churned_subscribers_today BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (creator_profile_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshot_date ON analytics (snapshot_date);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email VARCHAR(320) NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  submitter_user_profile_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  delivered_to_admin_count INTEGER NOT NULL DEFAULT 0,
  status contact_status NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email_created ON contacts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id CHAR(24) NOT NULL UNIQUE,
  singleton_key VARCHAR(16) NOT NULL DEFAULT 'primary' CHECK (singleton_key = 'primary'),
  platform_display_name TEXT NOT NULL DEFAULT 'Advanced Subscription & Membership Platform',
  support_email VARCHAR(320) NOT NULL DEFAULT 'support@asmp.app',
  default_subscriber_tier platform_default_subscriber_tier NOT NULL DEFAULT 'free',
  default_creator_status platform_default_creator_status NOT NULL DEFAULT 'review',
  platform_currency platform_currency NOT NULL DEFAULT 'usd',
  default_billing_cycle platform_billing_cycle NOT NULL DEFAULT 'monthly',
  renewal_reminder_lead_days INTEGER NOT NULL DEFAULT 7 CHECK (renewal_reminder_lead_days BETWEEN 0 AND 30),
  failure_alert_cadence platform_failure_cadence NOT NULL DEFAULT 'immediate',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (singleton_key)
);

-- App-layer compatibility: Clerk ids stay denormalized (Mongo queries by clerkUserId).
-- New rows may have no Mongo id.
ALTER TABLE user_profiles ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE creator_profiles ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE subscriber_profiles ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE plans ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE content ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE analytics ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN legacy_mongo_id DROP NOT NULL;
ALTER TABLE platform_settings ALTER COLUMN legacy_mongo_id DROP NOT NULL;

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(64);
ALTER TABLE subscriber_profiles ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(64);
ALTER TABLE content ADD COLUMN IF NOT EXISTS creator_clerk_user_id VARCHAR(64);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS creator_clerk_user_id VARCHAR(64);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscriber_clerk_user_id VARCHAR(64);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS creator_clerk_user_id VARCHAR(64);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscriber_clerk_user_id VARCHAR(64);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS creator_clerk_user_id VARCHAR(64);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_clerk_user_id VARCHAR(64);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS creator_clerk_user_id VARCHAR(64);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS submitter_clerk_user_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_clerk ON creator_profiles (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_profiles_clerk ON subscriber_profiles (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_content_creator_clerk ON content (creator_clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_plans_creator_clerk ON plans (creator_clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sub_clerk ON subscriptions (subscriber_clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_cre_clerk ON subscriptions (creator_clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_sub_clerk ON payments (subscriber_clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_clerk ON notifications (recipient_clerk_user_id);

UPDATE creator_profiles cp
SET clerk_user_id = up.clerk_user_id
FROM user_profiles up
WHERE cp.user_profile_id = up.id AND (cp.clerk_user_id IS NULL OR cp.clerk_user_id = '');

UPDATE subscriber_profiles sp
SET clerk_user_id = up.clerk_user_id
FROM user_profiles up
WHERE sp.user_profile_id = up.id AND (sp.clerk_user_id IS NULL OR sp.clerk_user_id = '');

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_invoice_unique
ON payments (stripe_invoice_id)
WHERE stripe_invoice_id IS NOT NULL AND stripe_invoice_id <> '';

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS platform_fee_bps INTEGER NOT NULL DEFAULT 10000
  CHECK (platform_fee_bps BETWEEN 0 AND 10000);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_clerk_pair
  ON subscriptions (subscriber_clerk_user_id, creator_clerk_user_id)
  WHERE subscriber_clerk_user_id IS NOT NULL AND subscriber_clerk_user_id <> ''
    AND creator_clerk_user_id IS NOT NULL AND creator_clerk_user_id <> '';

ALTER TABLE platform_settings
  ALTER COLUMN support_email SET DEFAULT 'support@asmp.app';
UPDATE platform_settings
SET support_email = 'support@asmp.app'
WHERE support_email IS NULL OR support_email = '' OR support_email = 'support@example.com';

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_access
  ON subscriptions (status, access_level);
CREATE INDEX IF NOT EXISTS idx_payments_status_paid
  ON payments (status, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status_created
  ON user_profiles (account_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_status_created
  ON content (status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_clerk_user_id VARCHAR(64) NOT NULL,
  actor_email VARCHAR(320) NOT NULL DEFAULT '',
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NOT NULL DEFAULT '',
  target_id VARCHAR(80) NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(128) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_events (created_at DESC);

