-- Create storage bucket for MOU documents
INSERT INTO storage.buckets (id, name, public) VALUES ('mou-documents', 'mou-documents', false);

-- Storage policies for MOU documents
CREATE POLICY "Staff can upload MOU documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mou-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can view MOU documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'mou-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can delete MOU documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'mou-documents' AND is_staff(auth.uid()));