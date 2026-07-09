-- Receipt Storage Bucket Configuration
-- Task 20.2: Configure Supabase Storage bucket for receipts
-- Requirements: 10.1

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false, -- Private bucket, requires authentication
  10485760, -- 10MB file size limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];

-- Storage Policy: Users can upload their own receipts
CREATE POLICY "Users can upload receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage Policy: Users can view their own receipts
CREATE POLICY "Users can view own receipts"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Finance team can view all receipts
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager', 'accountant')
      )
    )
  );

-- Storage Policy: Users can update their own receipts
CREATE POLICY "Users can update own receipts"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage Policy: Users can delete their own receipts
CREATE POLICY "Users can delete own receipts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage Policy: Finance team can manage all receipts
CREATE POLICY "Finance team can manage receipts"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager')
    )
  );
