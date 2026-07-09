-- Debug script to find where user_id column error occurs
-- Run this to test table creation order

DO $$
BEGIN
  RAISE NOTICE 'Step 1: Creating profiles table...';
  CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    main_role VARCHAR(50) DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  RAISE NOTICE 'Step 1: SUCCESS';

  RAISE NOTICE 'Step 2: Creating departments table...';
  CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  RAISE NOTICE 'Step 2: SUCCESS';

  RAISE NOTICE 'Step 3: Creating vendors table with user_id...';
  CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  RAISE NOTICE 'Step 3: SUCCESS';

  RAISE NOTICE 'Step 4: Creating custom_roles table...';
  CREATE TABLE IF NOT EXISTS custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  RAISE NOTICE 'Step 4: SUCCESS';

  RAISE NOTICE 'Step 5: Creating role_assignments table with user_id...';
  CREATE TABLE IF NOT EXISTS role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
  );
  RAISE NOTICE 'Step 5: SUCCESS';

  RAISE NOTICE 'Step 6: Testing SELECT with user_id from role_assignments...';
  PERFORM user_id FROM role_assignments LIMIT 1;
  RAISE NOTICE 'Step 6: SUCCESS';

  RAISE NOTICE 'Step 7: Testing SELECT with user_id from vendors...';
  PERFORM user_id FROM vendors LIMIT 1;
  RAISE NOTICE 'Step 7: SUCCESS';

  RAISE NOTICE 'All steps completed successfully!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR at current step: %', SQLERRM;
    RAISE;
END $$;
