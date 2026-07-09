

-- ============================================================
-- GLOBAL ENUM HANDLING
-- ============================================================

-- Ensure app_role enum exists and has the required finance roles
DO $$
BEGIN
    -- Check if the enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'vendor', 'customer', 'driver');
    END IF;

    -- Add missing finance roles if they don't exist
    -- PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE until v12+, 
    -- but Supabase is usually on 15+. To be safe, we use a sub-block.
    
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'finance_admin';
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'finance_manager';
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'finance_user';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'Finance Admin';
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'Finance Manager';
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'Finance User';
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'Admin';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- RBAC TABLES (Required for RLS Policies)
-- ============================================================

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  main_role VARCHAR(50) DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendors table if it doesn't exist (minimal structure for finance module)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create custom_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Create role_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ============================================================
-- FILE: 20260218155244_add_legacy_status.sql
-- ============================================================


-- Add 'legacy' status to vendor_status and mou_status enums
ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'legacy';
