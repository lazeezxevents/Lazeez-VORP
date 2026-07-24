-- Repairs MOU Vault file access when the database migration ran but the
-- corresponding Storage bucket was not created.
INSERT INTO storage.buckets (id, name, public)
VALUES ('mou-vault', 'mou-vault', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can view MOU vault files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload MOU vault files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update MOU vault files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete MOU vault files" ON storage.objects;

CREATE POLICY "Authenticated users can view MOU vault files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mou-vault');

CREATE POLICY "Staff can upload MOU vault files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update MOU vault files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete MOU vault files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mou-vault' AND public.is_staff(auth.uid()));
