-- ============================================================================
-- LAZEEZ VORP - Full Database Schema
-- Consolidated from all 11 migrations for fresh Supabase instance setup
-- Run this ENTIRE script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Core schema setup
-- ============================================================================

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'ops_manager', 'viewer');
CREATE TYPE public.vendor_status AS ENUM ('active', 'inactive', 'pending', 'blacklisted');
CREATE TYPE public.vendor_category AS ENUM ('catering', 'decoration', 'photography', 'entertainment', 'venue', 'logistics', 'other');
CREATE TYPE public.issue_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.mou_status AS ENUM ('draft', 'pending_review', 'approved', 'signed', 'expired', 'terminated');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category vendor_category NOT NULL DEFAULT 'other',
  status vendor_status NOT NULL DEFAULT 'pending',
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
  description TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issues table
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  reported_by UUID REFERENCES auth.users(id) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create MOUs table
CREATE TABLE public.mous (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status mou_status NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  terms TEXT,
  document_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_documents table
CREATE TABLE public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issue_comments table
CREATE TABLE public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mous ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user has any elevated role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'ops_manager')
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles policies (only admins can manage)
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Vendors policies
CREATE POLICY "All authenticated can view vendors" ON public.vendors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert vendors" ON public.vendors
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update vendors" ON public.vendors
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete vendors" ON public.vendors
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Issues policies
CREATE POLICY "All authenticated can view issues" ON public.issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated can create issues" ON public.issues
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Staff can update issues" ON public.issues
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid() OR reported_by = auth.uid());

CREATE POLICY "Admins can delete issues" ON public.issues
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- MOUs policies
CREATE POLICY "All authenticated can view MOUs" ON public.mous
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage MOUs" ON public.mous
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update MOUs" ON public.mous
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete MOUs" ON public.mous
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Vendor documents policies
CREATE POLICY "All authenticated can view documents" ON public.vendor_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can upload documents" ON public.vendor_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete documents" ON public.vendor_documents
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- Issue comments policies
CREATE POLICY "All authenticated can view comments" ON public.issue_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated can add comments" ON public.issue_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.issue_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mous_updated_at BEFORE UPDATE ON public.mous
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Give first user admin role, others get viewer
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for vendor documents
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-documents', 'vendor-documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can view documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'vendor-documents');

CREATE POLICY "Staff can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'vendor-documents' AND 
    public.is_staff(auth.uid())
  );

CREATE POLICY "Staff can delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'vendor-documents' AND 
    public.is_staff(auth.uid())
  );


-- ============================================================================
-- MIGRATION 2: MOU documents storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('mou-documents', 'mou-documents', false);

CREATE POLICY "Staff can upload MOU documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mou-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can view MOU documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'mou-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can delete MOU documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'mou-documents' AND is_staff(auth.uid()));


-- ============================================================================
-- MIGRATION 3: MOU version history
-- ============================================================================

CREATE TABLE public.mou_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mou_id UUID NOT NULL REFERENCES public.mous(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  vendor_id UUID NOT NULL,
  terms TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL,
  document_url TEXT,
  changed_by UUID,
  change_type TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mou_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view MOU versions"
ON public.mou_versions FOR SELECT
USING (true);

CREATE POLICY "Staff can create MOU versions"
ON public.mou_versions FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_mou_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
  change_type TEXT;
  change_summary TEXT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM public.mou_versions
  WHERE mou_id = NEW.id;
  
  IF TG_OP = 'INSERT' THEN
    change_type := 'created';
    change_summary := 'MOU created';
  ELSIF OLD.status != NEW.status THEN
    change_type := 'status_change';
    change_summary := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
  ELSIF OLD.terms IS DISTINCT FROM NEW.terms THEN
    change_type := 'terms_updated';
    change_summary := 'Terms and conditions updated';
  ELSIF OLD.document_url IS DISTINCT FROM NEW.document_url THEN
    change_type := 'document_updated';
    change_summary := CASE 
      WHEN NEW.document_url IS NOT NULL THEN 'Document uploaded'
      ELSE 'Document removed'
    END;
  ELSE
    change_type := 'updated';
    change_summary := 'MOU details updated';
  END IF;
  
  INSERT INTO public.mou_versions (
    mou_id, version_number, title, vendor_id, terms, 
    start_date, end_date, status, document_url, 
    changed_by, change_type, change_summary
  ) VALUES (
    NEW.id, next_version, NEW.title, NEW.vendor_id, NEW.terms,
    NEW.start_date, NEW.end_date, NEW.status, NEW.document_url,
    COALESCE(NEW.approved_by, NEW.created_by, auth.uid()), change_type, change_summary
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER mou_version_on_insert
AFTER INSERT ON public.mous
FOR EACH ROW
EXECUTE FUNCTION public.create_mou_version();

CREATE TRIGGER mou_version_on_update
AFTER UPDATE ON public.mous
FOR EACH ROW
EXECUTE FUNCTION public.create_mou_version();


-- ============================================================================
-- MIGRATION 4: Add 'employee' role
-- ============================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';


-- ============================================================================
-- MIGRATION 5: Designations, assignments, notification preferences
-- ============================================================================

CREATE TABLE public.designations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE public.employee_vendor_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, vendor_id)
);

CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mou_status_changes BOOLEAN NOT NULL DEFAULT true,
  mou_expiration_reminders BOOLEAN NOT NULL DEFAULT true,
  mou_expiration_days INTEGER[] NOT NULL DEFAULT '{7, 14, 30}',
  issue_assignments BOOLEAN NOT NULL DEFAULT true,
  issue_updates BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS designation_id UUID,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view designations" 
ON public.designations FOR SELECT 
USING (true);

CREATE POLICY "Staff can manage designations" 
ON public.designations FOR INSERT 
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update designations" 
ON public.designations FOR UPDATE 
USING (is_staff(auth.uid()));

CREATE POLICY "Admins can delete designations" 
ON public.designations FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view assignments" 
ON public.employee_vendor_assignments FOR SELECT 
USING (true);

CREATE POLICY "Staff can manage assignments" 
ON public.employee_vendor_assignments FOR INSERT 
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update assignments" 
ON public.employee_vendor_assignments FOR UPDATE 
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can delete assignments" 
ON public.employee_vendor_assignments FOR DELETE 
USING (is_staff(auth.uid()));

CREATE POLICY "Users can view own preferences" 
ON public.notification_preferences FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON public.notification_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON public.notification_preferences FOR UPDATE 
USING (auth.uid() = user_id);

INSERT INTO public.designations (name, description) VALUES
  ('Sales Executive', 'Handles sales and client acquisition'),
  ('Sales Representative', 'Represents the company in sales activities'),
  ('Account Manager', 'Manages vendor accounts and relationships'),
  ('Operations Coordinator', 'Coordinates operational activities'),
  ('Event Coordinator', 'Coordinates event planning and execution');

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'ops_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update user_roles insert policy to allow managers to add employees
CREATE POLICY "Staff can insert employee roles" 
ON public.user_roles FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)) 
  OR 
  (is_staff(auth.uid()) AND role = 'employee'::app_role)
);

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- MIGRATION 6: Designation FK constraint
-- ============================================================================

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_designation_id_fkey 
FOREIGN KEY (designation_id) REFERENCES public.designations(id) ON DELETE SET NULL;


-- ============================================================================
-- MIGRATION 7: Expanded vendor fields, audit logs
-- ============================================================================

-- Update vendor_status enum with new values
ALTER TYPE vendor_status RENAME TO vendor_status_old;
CREATE TYPE vendor_status AS ENUM ('onboarded', 'terminated', 'left', 'pending', 'new', 'active', 'inactive', 'blacklisted');

ALTER TABLE public.vendors 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE vendor_status USING status::text::vendor_status,
  ALTER COLUMN status SET DEFAULT 'new'::vendor_status;

DROP TYPE vendor_status_old;

-- Add new vendor fields
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_cnic text,
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_threshold integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sticker_status text DEFAULT 'not_issued',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS safiac_score numeric(3,1) DEFAULT 0;

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  user_id uuid,
  user_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view audit logs"
  ON public.audit_logs FOR SELECT USING (true);

CREATE POLICY "Staff can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (is_staff(auth.uid()));

CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Audit trigger functions
CREATE OR REPLACE FUNCTION public.log_vendor_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('vendor', NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES ('vendor', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('vendor', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER vendor_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_vendor_changes();

CREATE OR REPLACE FUNCTION public.log_mou_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('mou', NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES ('mou', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('mou', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER mou_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.mous
  FOR EACH ROW EXECUTE FUNCTION public.log_mou_changes();

CREATE OR REPLACE FUNCTION public.log_issue_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('issue', NEW.id, 'created', to_jsonb(NEW), NEW.reported_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES ('issue', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('issue', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER issue_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.log_issue_changes();

ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;


-- ============================================================================
-- MIGRATION 8: Avatars storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ============================================================================
-- MIGRATION 9: Vendor categories, payments, remarks
-- ============================================================================

ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'home_chef';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'home_baker';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'bakery';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'restaurant';

ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS bank_title text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS subscription_after_orders integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  order_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  upfront_amount numeric NOT NULL DEFAULT 0,
  upfront_percentage numeric NOT NULL DEFAULT 0,
  upfront_paid_at timestamp with time zone,
  remaining_amount numeric NOT NULL DEFAULT 0,
  remaining_released_at timestamp with time zone,
  payment_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_remarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  remark text NOT NULL,
  remark_type text DEFAULT 'general',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view payments"
ON public.vendor_payments FOR SELECT USING (true);

CREATE POLICY "Staff can create payments"
ON public.vendor_payments FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update payments"
ON public.vendor_payments FOR UPDATE
USING (is_staff(auth.uid()));

CREATE POLICY "Admins can delete payments"
ON public.vendor_payments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view remarks"
ON public.vendor_remarks FOR SELECT USING (true);

CREATE POLICY "Staff can create remarks"
ON public.vendor_remarks FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Admins can delete remarks"
ON public.vendor_remarks FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vendor_payments_updated_at
BEFORE UPDATE ON public.vendor_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_payment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('payment', NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES ('payment', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('payment', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_remark_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('remark', NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('remark', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_vendor_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_changes();

CREATE TRIGGER audit_vendor_remarks_trigger
AFTER INSERT OR DELETE ON public.vendor_remarks
FOR EACH ROW
EXECUTE FUNCTION public.log_remark_changes();


-- ============================================================================
-- MIGRATION 10: MOU Vault
-- ============================================================================

CREATE TYPE mou_document_type AS ENUM ('new', 'legacy');
CREATE TYPE mou_extraction_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE public.mou_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  mou_id UUID REFERENCES public.mous(id) ON DELETE SET NULL,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type mou_document_type NOT NULL DEFAULT 'new',
  signed_date DATE,
  termination_notice_days INTEGER DEFAULT 90,
  termination_deadline DATE,
  effective_start_date DATE,
  effective_end_date DATE,
  extracted_terms JSONB,
  extraction_status mou_extraction_status NOT NULL DEFAULT 'pending',
  extraction_confidence DECIMAL(5,2),
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mou_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vault documents"
ON public.mou_vault FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert vault documents"
ON public.mou_vault FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update vault documents"
ON public.mou_vault FOR UPDATE
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete vault documents"
ON public.mou_vault FOR DELETE
USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_mou_vault_updated_at
BEFORE UPDATE ON public.mou_vault
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_mou_vault_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
    VALUES ('mou_vault', NEW.id, 'created', to_jsonb(NEW), NEW.uploaded_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES ('mou_vault', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, user_id)
    VALUES ('mou_vault', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER log_mou_vault_changes
AFTER INSERT OR UPDATE OR DELETE ON public.mou_vault
FOR EACH ROW EXECUTE FUNCTION public.log_mou_vault_changes();

INSERT INTO storage.buckets (id, name, public)
VALUES ('mou-vault', 'mou-vault', false);

CREATE POLICY "Authenticated users can view MOU vault files"
ON storage.objects FOR SELECT
USING (bucket_id = 'mou-vault' AND auth.uid() IS NOT NULL);

CREATE POLICY "Staff can upload MOU vault files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update MOU vault files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete MOU vault files"
ON storage.objects FOR DELETE
USING (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.mou_vault;


-- ============================================================================
-- MIGRATION 11: MOU Vault party details and revisions
-- ============================================================================

ALTER TABLE public.mou_vault 
ADD COLUMN IF NOT EXISTS has_auto_renewal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS renewal_period_days integer DEFAULT 365,
ADD COLUMN IF NOT EXISTS party_1_name text,
ADD COLUMN IF NOT EXISTS party_1_business text,
ADD COLUMN IF NOT EXISTS party_2_name text,
ADD COLUMN IF NOT EXISTS party_2_business text,
ADD COLUMN IF NOT EXISTS mou_purpose text,
ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_renewal_date date;

CREATE TYPE public.mou_revision_type AS ENUM ('amendment', 'renewal', 'termination');

CREATE TABLE public.mou_vault_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_id uuid NOT NULL REFERENCES public.mou_vault(id) ON DELETE CASCADE,
  revision_type public.mou_revision_type NOT NULL,
  revision_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  document_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mou_vault_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view revisions"
  ON public.mou_vault_revisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert revisions"
  ON public.mou_vault_revisions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update revisions"
  ON public.mou_vault_revisions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete revisions"
  ON public.mou_vault_revisions FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_mou_vault_revisions_vault_id ON public.mou_vault_revisions(vault_id);

CREATE TRIGGER mou_vault_revisions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.mou_vault_revisions
  FOR EACH ROW EXECUTE FUNCTION public.log_mou_vault_changes();


-- ============================================================================
-- DONE! Your database schema is now fully initialized.
-- ============================================================================
