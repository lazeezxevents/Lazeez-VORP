-- Create document type enum
CREATE TYPE mou_document_type AS ENUM ('new', 'legacy');

-- Create extraction status enum  
CREATE TYPE mou_extraction_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create mou_vault table
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

-- Enable RLS
ALTER TABLE public.mou_vault ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mou_vault
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

-- Create updated_at trigger
CREATE TRIGGER update_mou_vault_updated_at
BEFORE UPDATE ON public.mou_vault
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Audit logging trigger for mou_vault
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

-- Create mou-vault storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('mou-vault', 'mou-vault', false);

-- Storage policies for mou-vault bucket
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

-- Enable realtime for mou_vault
ALTER PUBLICATION supabase_realtime ADD TABLE public.mou_vault;