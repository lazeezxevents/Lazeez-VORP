-- ============================================================================
-- Role Management Cleanup: Transition from 'viewer' to 'employee'
-- ============================================================================

-- 1. Update existing roles from 'viewer' to 'employee'
-- Note: 'employee' is part of the application type, but the DB enum might not have it yet.
-- Let's check if 'employee' exists in the app_role enum. 
-- If not, we add it.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'employee') THEN
        ALTER TYPE public.app_role ADD VALUE 'employee';
    END IF;
END $$;

-- 2. Update existing viewer roles to employee
UPDATE public.user_roles SET role = 'employee'::public.app_role WHERE role = 'viewer'::public.app_role;

-- 3. Update the handle_new_user function to use 'employee' as default instead of 'viewer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Give first user admin role and auto-approve, others are pending
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.profiles (id, email, full_name, is_approved)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (id, email, full_name, is_approved, requested_role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', false, 'employee');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Update profiles requested_role default
ALTER TABLE public.profiles ALTER COLUMN requested_role SET DEFAULT 'employee';
UPDATE public.profiles SET requested_role = 'employee' WHERE requested_role = 'viewer';
