-- Create MOU version history table
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

-- Enable RLS
ALTER TABLE public.mou_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated can view MOU versions"
ON public.mou_versions FOR SELECT
USING (true);

CREATE POLICY "Staff can create MOU versions"
ON public.mou_versions FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Create trigger function to auto-create versions
CREATE OR REPLACE FUNCTION public.create_mou_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
  change_type TEXT;
  change_summary TEXT;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM public.mou_versions
  WHERE mou_id = NEW.id;
  
  -- Determine change type
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
  
  -- Insert version record
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

-- Create triggers
CREATE TRIGGER mou_version_on_insert
AFTER INSERT ON public.mous
FOR EACH ROW
EXECUTE FUNCTION public.create_mou_version();

CREATE TRIGGER mou_version_on_update
AFTER UPDATE ON public.mous
FOR EACH ROW
EXECUTE FUNCTION public.create_mou_version();