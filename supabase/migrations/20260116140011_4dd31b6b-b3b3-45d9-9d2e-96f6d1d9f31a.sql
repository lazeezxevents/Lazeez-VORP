-- Add new vendor status enum values
ALTER TYPE vendor_status RENAME TO vendor_status_old;
CREATE TYPE vendor_status AS ENUM ('onboarded', 'terminated', 'left', 'pending', 'new', 'active', 'inactive', 'blacklisted');

-- Update vendors table to use new status
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
  entity_type text NOT NULL, -- 'vendor', 'mou', 'issue'
  entity_id uuid NOT NULL,
  action text NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', 'assigned'
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  user_id uuid,
  user_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_logs
CREATE POLICY "All authenticated can view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can create audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (is_staff(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Create function to log vendor changes automatically
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

-- Create trigger for vendor changes
CREATE TRIGGER vendor_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_vendor_changes();

-- Create function to log MOU changes
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

-- Create trigger for MOU changes
CREATE TRIGGER mou_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.mous
  FOR EACH ROW EXECUTE FUNCTION public.log_mou_changes();

-- Create function to log issue changes
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

-- Create trigger for issue changes
CREATE TRIGGER issue_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.log_issue_changes();

-- Enable realtime for audit_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;