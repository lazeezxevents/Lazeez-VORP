-- Create designations table for employee designations
CREATE TABLE public.designations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create employee_vendor_assignments table
CREATE TABLE public.employee_vendor_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, vendor_id)
);

-- Create notification_preferences table
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

-- Add designation_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS designation_id UUID,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- Enable RLS on new tables
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Designations policies
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

-- Employee vendor assignments policies
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

-- Notification preferences policies
CREATE POLICY "Users can view own preferences" 
ON public.notification_preferences FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON public.notification_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON public.notification_preferences FOR UPDATE 
USING (auth.uid() = user_id);

-- Insert default designations
INSERT INTO public.designations (name, description) VALUES
  ('Sales Executive', 'Handles sales and client acquisition'),
  ('Sales Representative', 'Represents the company in sales activities'),
  ('Account Manager', 'Manages vendor accounts and relationships'),
  ('Operations Coordinator', 'Coordinates operational activities'),
  ('Event Coordinator', 'Coordinates event planning and execution');

-- Create function to check if user is manager or admin
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

-- Update user_roles policies to allow managers to add employees
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Staff can insert employee roles" 
ON public.user_roles FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)) 
  OR 
  (is_staff(auth.uid()) AND role = 'employee'::app_role)
);

-- Trigger for notification preferences updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();