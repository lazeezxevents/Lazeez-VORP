-- Migration: Create finance_revenue_streams
-- Date: 2026-05-01

-- Create a table to store configurable revenue streams (commission, subscription, etc.)
CREATE TABLE IF NOT EXISTS finance_revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  stream_type VARCHAR(32) NOT NULL, -- 'commission' | 'subscription' | other
  commission_percent NUMERIC(5,2) DEFAULT 0, -- used when stream_type = 'commission'
  monthly_amount NUMERIC(18,2) DEFAULT 0, -- used when stream_type = 'subscription'
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_finance_revenue_streams_stream_type'
  ) THEN
    CREATE INDEX idx_finance_revenue_streams_stream_type ON finance_revenue_streams(stream_type);
  END IF;
END$$;

-- Ensure name uniqueness for convenience (optional, can be relaxed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_finance_revenue_streams_name'
  ) THEN
    ALTER TABLE finance_revenue_streams ADD CONSTRAINT uq_finance_revenue_streams_name UNIQUE (name);
  END IF;
END$$;
