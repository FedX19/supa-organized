-- SupaOrganized Stripe Data Persistence Schema
-- Run this in your SupaOrganized Supabase database
-- This stores synced Stripe data for persistence across sessions

-- ===========================================
-- STRIPE SUBSCRIPTIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id TEXT PRIMARY KEY, -- Stripe subscription ID
  customer_id TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  status TEXT NOT NULL,
  plan_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  plan_interval TEXT DEFAULT 'month',
  plan_interval_count INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'usd',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  start_date TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  coupon_id TEXT,
  coupon_name TEXT,
  coupon_percent_off DECIMAL(5,2),
  coupon_amount_off DECIMAL(10,2),
  coupon_duration TEXT,
  discounted_amount DECIMAL(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer ON stripe_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_canceled ON stripe_subscriptions(canceled_at);

-- ===========================================
-- STRIPE PAYMENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_payments (
  id TEXT PRIMARY KEY, -- Stripe charge ID
  customer_id TEXT NOT NULL,
  customer_email TEXT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_refunded DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  invoice_id TEXT,
  description TEXT,
  failure_message TEXT,
  refunded BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer ON stripe_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_created ON stripe_payments(created_at);

-- ===========================================
-- STRIPE CANCELLATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_cancellations (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  canceled_at TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  reason TEXT,
  monthly_value DECIMAL(10,2) DEFAULT 0,
  subscription_type TEXT DEFAULT 'individual',
  days_as_customer INTEGER DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  last_payment_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_cancellations_date ON stripe_cancellations(canceled_at);

-- ===========================================
-- STRIPE COUPONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_coupons (
  id TEXT PRIMARY KEY, -- Stripe coupon ID
  name TEXT,
  percent_off DECIMAL(5,2),
  amount_off DECIMAL(10,2),
  currency TEXT,
  duration TEXT,
  duration_in_months INTEGER,
  times_redeemed INTEGER DEFAULT 0,
  max_redemptions INTEGER,
  valid BOOLEAN DEFAULT TRUE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- STRIPE SYNC METADATA TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_sync_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row allowed
  last_synced_at TIMESTAMPTZ,
  subscriptions_count INTEGER DEFAULT 0,
  payments_count INTEGER DEFAULT 0,
  cancellations_count INTEGER DEFAULT 0,
  customers_count INTEGER DEFAULT 0,
  coupons_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'never',
  sync_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize the metadata row
INSERT INTO stripe_sync_metadata (id, sync_status)
VALUES (1, 'never')
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_sync_metadata ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write (admin only in production)
CREATE POLICY "Allow authenticated full access stripe_subscriptions" ON stripe_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access stripe_payments" ON stripe_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access stripe_cancellations" ON stripe_cancellations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access stripe_coupons" ON stripe_coupons
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access stripe_sync_metadata" ON stripe_sync_metadata
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON stripe_subscriptions TO authenticated;
GRANT ALL ON stripe_payments TO authenticated;
GRANT ALL ON stripe_cancellations TO authenticated;
GRANT ALL ON stripe_coupons TO authenticated;
GRANT ALL ON stripe_sync_metadata TO authenticated;
