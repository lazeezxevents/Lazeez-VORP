
-- Migration to add missing vendor columns and categories for AI MOU flow
DO $$ BEGIN
    ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'home_chef';
    ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'home_baker';
    ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'restaurant';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 14,
ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10,2) DEFAULT 5000,
ADD COLUMN IF NOT EXISTS subscription_threshold INTEGER DEFAULT 5;
