
-- Production Fixes: User Deletion & RLS Policies
-- Remove specific user
DELETE FROM auth.users WHERE email = 'raza@lazeezevents.com';

-- Fix Profile RLS: Admins need delete permission to remove user requests
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can delete any profile'
    ) THEN
        CREATE POLICY "Admins can delete any profile" ON public.profiles
          FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Ensure admins can see and update roles (already exist but reinforcing)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_roles' AND policyname = 'Admins can delete any role'
    ) THEN
        CREATE POLICY "Admins can delete any role" ON public.user_roles
          FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
