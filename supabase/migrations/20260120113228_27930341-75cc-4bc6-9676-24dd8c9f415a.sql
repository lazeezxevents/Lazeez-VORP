-- Update vendor_category enum with new business categories
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'home_chef';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'home_baker';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'bakery';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'restaurant';

-- Add bank details and subscription orders field to vendors
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS bank_title text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS subscription_after_orders integer DEFAULT 0;

-- Create vendor_payments table for tracking order payments
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

-- Create vendor_remarks table for tracking vendor remarks/notes over time
CREATE TABLE IF NOT EXISTS public.vendor_remarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  remark text NOT NULL,
  remark_type text DEFAULT 'general',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_remarks ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_payments
CREATE POLICY "All authenticated can view payments"
ON public.vendor_payments FOR SELECT
USING (true);

CREATE POLICY "Staff can create payments"
ON public.vendor_payments FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update payments"
ON public.vendor_payments FOR UPDATE
USING (is_staff(auth.uid()));

CREATE POLICY "Admins can delete payments"
ON public.vendor_payments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for vendor_remarks
CREATE POLICY "All authenticated can view remarks"
ON public.vendor_remarks FOR SELECT
USING (true);

CREATE POLICY "Staff can create remarks"
ON public.vendor_remarks FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Admins can delete remarks"
ON public.vendor_remarks FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for vendor_payments
CREATE TRIGGER update_vendor_payments_updated_at
BEFORE UPDATE ON public.vendor_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create log functions for new tables
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

-- Audit triggers for new tables
CREATE TRIGGER audit_vendor_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_changes();

CREATE TRIGGER audit_vendor_remarks_trigger
AFTER INSERT OR DELETE ON public.vendor_remarks
FOR EACH ROW
EXECUTE FUNCTION public.log_remark_changes();