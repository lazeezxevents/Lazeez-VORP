-- ============================================================================
-- User Approval System Migration
-- Run this in Supabase SQL Editor after the main schema
-- ============================================================================

-- Add approval status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'viewer';

-- Update the handle_new_user function to set first user as approved
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
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', false, 'viewer');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Policy: allow admins to update any profile (for approval)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
