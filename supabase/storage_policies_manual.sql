-- ============================================================================
-- Storage Policies for Issue Attachments Bucket
-- ============================================================================
-- IMPORTANT: This file must be executed MANUALLY via Supabase Dashboard
-- using the SQL Editor with elevated permissions, or via the Dashboard UI.
--
-- Reason: Storage policies require special permissions that regular migrations
-- don't have by default.
--
-- To execute:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run"
-- ============================================================================

BEGIN;

-- Drop existing policies if any (to allow re-running this script)
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own issue attachments" ON storage.objects;

-- ============================================================================
-- Policy 1: Allow authenticated users to upload files
-- ============================================================================
CREATE POLICY "Authenticated users can upload issue attachments"
ON storage.objects 
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'issue-attachments'
);

-- ============================================================================
-- Policy 2: Allow authenticated users to read/download files
-- ============================================================================
CREATE POLICY "Authenticated users can read issue attachments"
ON storage.objects 
FOR SELECT
TO authenticated
USING (
    bucket_id = 'issue-attachments'
);

-- ============================================================================
-- Policy 3: Allow authenticated users to delete files
-- ============================================================================
-- Note: Application-level checks ensure users can only delete their own
-- attachments via the issue_attachments table
CREATE POLICY "Users can delete their own issue attachments"
ON storage.objects 
FOR DELETE
TO authenticated
USING (
    bucket_id = 'issue-attachments'
);

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the policies were created successfully:
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects' 
AND policyname LIKE '%issue attachments%'
ORDER BY policyname;

-- Expected result: 3 policies should be listed
