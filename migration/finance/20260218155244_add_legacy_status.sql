-- Add 'legacy' status to vendor_status and mou_status enums
ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'legacy';
ALTER TYPE public.mou_status ADD VALUE IF NOT EXISTS 'legacy';

-- Comment explaining the transition
COMMENT ON COLUMN public.vendors.status IS 'Status of the vendor. "legacy" refers to vendors whose MOU is older than 3 months.';
COMMENT ON COLUMN public.mous.status IS 'Status of the MOU. "legacy" refers to MOUs older than 3 months.';

-- Function to find vendors who only have legacy MOUs
CREATE OR REPLACE FUNCTION public.get_vendors_with_only_legacy_mous()
RETURNS TABLE (id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id
  FROM public.vendors v
  WHERE v.status != 'legacy'
  AND NOT EXISTS (
    SELECT 1 FROM public.mous m 
    WHERE m.vendor_id = v.id 
    AND m.status IN ('active', 'approved', 'signed', 'pending_review')
  )
  AND EXISTS (
    SELECT 1 FROM public.mous m 
    WHERE m.vendor_id = v.id 
    AND m.status = 'legacy'
  );
END;
$$;

