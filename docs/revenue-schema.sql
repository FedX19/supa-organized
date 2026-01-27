-- SupaOrganized Revenue Tracking Schema
-- Run this in your SupaOrganized Supabase database (not customer databases)

-- ===========================================
-- CUSTOMERS TABLE
-- ===========================================
-- Stores all customers (individual members and league coaches)
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('individual', 'league')),
  organization_name TEXT, -- For league coaches
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_type ON customers(customer_type);

-- ===========================================
-- SUBSCRIPTIONS TABLE
-- ===========================================
-- Tracks subscription details for each customer
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('individual_monthly', 'league_seasonal')),
  amount_cents INTEGER NOT NULL, -- $20 = 2000, $200 = 20000
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan_type ON subscriptions(plan_type);

-- ===========================================
-- PAYMENTS TABLE
-- ===========================================
-- Records all payments made
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
  payment_method TEXT, -- 'card', 'bank_transfer', etc.
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  stripe_payment_id TEXT, -- For future Stripe integration
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- ===========================================
-- CANCELLATIONS TABLE
-- ===========================================
-- Detailed cancellation records
CREATE TABLE IF NOT EXISTS cancellations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  reason_category TEXT CHECK (reason_category IN ('too_expensive', 'not_using', 'switching', 'temporary', 'other', 'unknown')),
  monthly_revenue_lost_cents INTEGER,
  customer_lifetime_days INTEGER,
  total_revenue_cents INTEGER, -- Total paid before cancellation
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cancellations_customer_id ON cancellations(customer_id);
CREATE INDEX idx_cancellations_date ON cancellations(cancelled_at);
CREATE INDEX idx_cancellations_reason ON cancellations(reason_category);

-- ===========================================
-- REVENUE SNAPSHOTS TABLE
-- ===========================================
-- Monthly snapshots for historical tracking
CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  mrr_cents INTEGER NOT NULL DEFAULT 0, -- Monthly Recurring Revenue
  arr_cents INTEGER NOT NULL DEFAULT 0, -- Annual Recurring Revenue
  total_customers INTEGER NOT NULL DEFAULT 0,
  individual_customers INTEGER NOT NULL DEFAULT 0,
  league_customers INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0, -- New this month
  churned_customers INTEGER NOT NULL DEFAULT 0, -- Cancelled this month
  churn_rate DECIMAL(5,2), -- Percentage
  individual_revenue_cents INTEGER NOT NULL DEFAULT 0,
  league_revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_snapshots_date ON revenue_snapshots(snapshot_date);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to get current season
CREATE OR REPLACE FUNCTION get_current_season()
RETURNS TEXT AS $$
DECLARE
  current_month INTEGER;
  current_day INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM NOW());
  current_day := EXTRACT(DAY FROM NOW());

  -- Spring: Feb 15 - Aug 14
  -- Fall: Aug 15 - Feb 14
  IF (current_month > 2 OR (current_month = 2 AND current_day >= 15))
     AND (current_month < 8 OR (current_month = 8 AND current_day < 15)) THEN
    RETURN 'spring';
  ELSE
    RETURN 'fall';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get next season payment date for leagues
CREATE OR REPLACE FUNCTION get_next_season_date()
RETURNS DATE AS $$
DECLARE
  current_month INTEGER;
  current_day INTEGER;
  current_year INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM NOW());
  current_day := EXTRACT(DAY FROM NOW());
  current_year := EXTRACT(YEAR FROM NOW());

  -- If before Feb 15, next payment is Feb 15 this year
  IF current_month < 2 OR (current_month = 2 AND current_day < 15) THEN
    RETURN MAKE_DATE(current_year, 2, 15);
  -- If before Aug 15, next payment is Aug 15 this year
  ELSIF current_month < 8 OR (current_month = 8 AND current_day < 15) THEN
    RETURN MAKE_DATE(current_year, 8, 15);
  -- Otherwise next payment is Feb 15 next year
  ELSE
    RETURN MAKE_DATE(current_year + 1, 2, 15);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read revenue data (admin only in production)
CREATE POLICY "Allow authenticated read customers" ON customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read subscriptions" ON subscriptions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read payments" ON payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read cancellations" ON cancellations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read snapshots" ON revenue_snapshots
  FOR SELECT TO authenticated USING (true);

-- ===========================================
-- SAMPLE TEST DATA
-- ===========================================
-- Insert sample customers
INSERT INTO customers (id, email, full_name, customer_type, organization_name, status, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'john@example.com', 'John Smith', 'individual', NULL, 'active', NOW() - INTERVAL '6 months'),
  ('22222222-2222-2222-2222-222222222222', 'jane@example.com', 'Jane Doe', 'individual', NULL, 'active', NOW() - INTERVAL '4 months'),
  ('33333333-3333-3333-3333-333333333333', 'mike@example.com', 'Mike Johnson', 'individual', NULL, 'active', NOW() - INTERVAL '3 months'),
  ('44444444-4444-4444-4444-444444444444', 'sarah@example.com', 'Sarah Wilson', 'individual', NULL, 'active', NOW() - INTERVAL '2 months'),
  ('55555555-5555-5555-5555-555555555555', 'bob@example.com', 'Bob Brown', 'individual', NULL, 'cancelled', NOW() - INTERVAL '5 months'),
  ('66666666-6666-6666-6666-666666666666', 'coach.tom@league.com', 'Coach Tom', 'league', 'Eastside Youth Soccer', 'active', NOW() - INTERVAL '8 months'),
  ('77777777-7777-7777-7777-777777777777', 'coach.lisa@league.com', 'Coach Lisa', 'league', 'Downtown Basketball Club', 'active', NOW() - INTERVAL '6 months'),
  ('88888888-8888-8888-8888-888888888888', 'coach.david@league.com', 'Coach David', 'league', 'Northside Little League', 'active', NOW() - INTERVAL '4 months'),
  ('99999999-9999-9999-9999-999999999999', 'emily@example.com', 'Emily Chen', 'individual', NULL, 'active', NOW() - INTERVAL '1 month'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alex@example.com', 'Alex Rivera', 'individual', NULL, 'active', NOW() - INTERVAL '15 days')
ON CONFLICT (email) DO NOTHING;

-- Insert sample subscriptions
INSERT INTO subscriptions (customer_id, plan_type, amount_cents, status, current_period_start, current_period_end, cancelled_at, cancellation_reason) VALUES
  ('11111111-1111-1111-1111-111111111111', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', NULL, NULL),
  ('22222222-2222-2222-2222-222222222222', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', NULL, NULL),
  ('33333333-3333-3333-3333-333333333333', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '25 days', NOW() + INTERVAL '5 days', NULL, NULL),
  ('44444444-4444-4444-4444-444444444444', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '40 days', NOW() - INTERVAL '10 days', NULL, NULL),
  ('55555555-5555-5555-5555-555555555555', 'individual_monthly', 2000, 'cancelled', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 'Too expensive'),
  ('66666666-6666-6666-6666-666666666666', 'league_seasonal', 20000, 'active', '2024-08-15', '2025-02-14', NULL, NULL),
  ('77777777-7777-7777-7777-777777777777', 'league_seasonal', 20000, 'active', '2024-08-15', '2025-02-14', NULL, NULL),
  ('88888888-8888-8888-8888-888888888888', 'league_seasonal', 20000, 'active', '2024-08-15', '2025-02-14', NULL, NULL),
  ('99999999-9999-9999-9999-999999999999', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '1 month', NOW(), NULL, NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'individual_monthly', 2000, 'active', NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Insert sample payments (last 12 months of history)
INSERT INTO payments (customer_id, amount_cents, status, payment_method, payment_date) VALUES
  -- Individual monthly payments
  ('11111111-1111-1111-1111-111111111111', 2000, 'succeeded', 'card', NOW() - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-111111111111', 2000, 'succeeded', 'card', NOW() - INTERVAL '35 days'),
  ('11111111-1111-1111-1111-111111111111', 2000, 'succeeded', 'card', NOW() - INTERVAL '65 days'),
  ('22222222-2222-2222-2222-222222222222', 2000, 'succeeded', 'card', NOW() - INTERVAL '10 days'),
  ('22222222-2222-2222-2222-222222222222', 2000, 'succeeded', 'card', NOW() - INTERVAL '40 days'),
  ('33333333-3333-3333-3333-333333333333', 2000, 'succeeded', 'card', NOW() - INTERVAL '25 days'),
  ('33333333-3333-3333-3333-333333333333', 2000, 'succeeded', 'card', NOW() - INTERVAL '55 days'),
  ('44444444-4444-4444-4444-444444444444', 2000, 'succeeded', 'card', NOW() - INTERVAL '40 days'),
  ('99999999-9999-9999-9999-999999999999', 2000, 'succeeded', 'card', NOW() - INTERVAL '30 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2000, 'succeeded', 'card', NOW() - INTERVAL '15 days'),
  -- League seasonal payments
  ('66666666-6666-6666-6666-666666666666', 20000, 'succeeded', 'card', '2024-08-15'),
  ('66666666-6666-6666-6666-666666666666', 20000, 'succeeded', 'card', '2024-02-15'),
  ('77777777-7777-7777-7777-777777777777', 20000, 'succeeded', 'card', '2024-08-15'),
  ('88888888-8888-8888-8888-888888888888', 20000, 'succeeded', 'card', '2024-08-15')
ON CONFLICT DO NOTHING;

-- Insert sample cancellation
INSERT INTO cancellations (customer_id, cancelled_at, reason, reason_category, monthly_revenue_lost_cents, customer_lifetime_days, total_revenue_cents, feedback) VALUES
  ('55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '30 days', 'Too expensive for my budget', 'too_expensive', 2000, 150, 10000, 'Loved the product but need to cut costs')
ON CONFLICT DO NOTHING;

-- Insert sample revenue snapshots for last 12 months
INSERT INTO revenue_snapshots (snapshot_date, mrr_cents, arr_cents, total_customers, individual_customers, league_customers, new_customers, churned_customers, churn_rate, individual_revenue_cents, league_revenue_cents) VALUES
  (DATE_TRUNC('month', NOW()) - INTERVAL '11 months', 6000, 72000, 3, 3, 0, 3, 0, 0, 6000, 0),
  (DATE_TRUNC('month', NOW()) - INTERVAL '10 months', 8000, 96000, 4, 4, 0, 1, 0, 0, 8000, 0),
  (DATE_TRUNC('month', NOW()) - INTERVAL '9 months', 10000, 120000, 5, 5, 0, 1, 0, 0, 10000, 0),
  (DATE_TRUNC('month', NOW()) - INTERVAL '8 months', 13333, 160000, 6, 5, 1, 1, 0, 0, 10000, 3333),
  (DATE_TRUNC('month', NOW()) - INTERVAL '7 months', 16666, 200000, 7, 5, 2, 1, 0, 0, 10000, 6666),
  (DATE_TRUNC('month', NOW()) - INTERVAL '6 months', 19999, 240000, 8, 5, 3, 1, 0, 0, 10000, 9999),
  (DATE_TRUNC('month', NOW()) - INTERVAL '5 months', 21999, 264000, 9, 6, 3, 1, 0, 0, 12000, 9999),
  (DATE_TRUNC('month', NOW()) - INTERVAL '4 months', 23999, 288000, 9, 6, 3, 0, 0, 0, 14000, 9999),
  (DATE_TRUNC('month', NOW()) - INTERVAL '3 months', 23999, 288000, 9, 6, 3, 0, 0, 0, 14000, 9999),
  (DATE_TRUNC('month', NOW()) - INTERVAL '2 months', 25999, 312000, 10, 7, 3, 1, 0, 0, 16000, 9999),
  (DATE_TRUNC('month', NOW()) - INTERVAL '1 month', 27999, 336000, 11, 8, 3, 2, 1, 9.09, 18000, 9999),
  (DATE_TRUNC('month', NOW()), 29999, 360000, 12, 9, 3, 2, 0, 0, 20000, 9999)
ON CONFLICT (snapshot_date) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON customers TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON payments TO authenticated;
GRANT SELECT ON cancellations TO authenticated;
GRANT SELECT ON revenue_snapshots TO authenticated;
