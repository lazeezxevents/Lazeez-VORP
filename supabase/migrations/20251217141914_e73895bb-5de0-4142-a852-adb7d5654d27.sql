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

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

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