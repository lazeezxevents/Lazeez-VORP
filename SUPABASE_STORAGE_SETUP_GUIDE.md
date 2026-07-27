# Supabase Storage Setup Guide for Issue Attachments

## Issue Encountered
When running the migration `20260727_create_issue_storage_bucket.sql`, you may encounter:
```
ERROR: 42501: must be owner of relation objects
```

This error occurs because storage policies require elevated permissions that standard migrations don't have.

## Solution: Manual Storage Setup

Follow these steps to set up the issue attachments storage:

---

## Step 1: Create the Storage Bucket

### Option A: Via Supabase Dashboard (Recommended)
1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure the bucket:
   - **Name**: `issue-attachments`
   - **Public bucket**: ✅ Yes (enabled)
   - **File size limit**: `52428800` (50 MB)
   - **Allowed MIME types**: Leave empty or specify:
     ```
     image/jpeg, image/png, image/gif, image/webp, image/svg+xml,
     application/pdf, application/msword,
     application/vnd.openxmlformats-officedocument.wordprocessingml.document,
     application/vnd.ms-excel,
     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
     text/plain, text/csv, application/zip
     ```
4. Click **"Create bucket"**

### Option B: Via SQL (If you prefer)
The migration file will attempt to create the bucket automatically. If it succeeds, great! If not, use Option A.

---

## Step 2: Create Storage Policies

### Option A: Via SQL Editor (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Copy the contents of `supabase/storage_policies_manual.sql` and paste it
4. Click **"Run"** or press `Ctrl+Enter`
5. Verify 3 policies were created successfully

**Contents of `storage_policies_manual.sql`:**
```sql
BEGIN;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own issue attachments" ON storage.objects;

-- Policy 1: Upload
CREATE POLICY "Authenticated users can upload issue attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'issue-attachments');

-- Policy 2: Read
CREATE POLICY "Authenticated users can read issue attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'issue-attachments');

-- Policy 3: Delete
CREATE POLICY "Users can delete their own issue attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'issue-attachments');

COMMIT;
```

### Option B: Via Dashboard UI

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Select the `issue-attachments` bucket
3. Click **"New policy"** for each policy below:

**Policy 1: Upload Files**
- **Policy name**: `Authenticated users can upload issue attachments`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: Leave empty
- **WITH CHECK expression**: `bucket_id = 'issue-attachments'`

**Policy 2: Read Files**
- **Policy name**: `Authenticated users can read issue attachments`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'issue-attachments'`
- **WITH CHECK expression**: Leave empty

**Policy 3: Delete Files**
- **Policy name**: `Users can delete their own issue attachments`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'issue-attachments'`
- **WITH CHECK expression**: Leave empty

---

## Step 3: Verify Setup

### Check Bucket Exists
1. Go to **Storage** in Supabase Dashboard
2. You should see `issue-attachments` in the list
3. Click on it to view its settings

### Check Policies
Run this query in SQL Editor:
```sql
SELECT 
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE tablename = 'objects' 
AND policyname LIKE '%issue attachments%'
ORDER BY policyname;
```

**Expected result**: 3 rows
- Authenticated users can upload issue attachments (INSERT)
- Authenticated users can read issue attachments (SELECT)
- Users can delete their own issue attachments (DELETE)

---

## Step 4: Test Upload

### Via Application
1. Go to the **Issues** page
2. Click on any issue to open the detail panel
3. Go to the **Attachments** tab
4. Click **"Select Files"** and choose a test file
5. Click **"Upload"**
6. File should upload successfully

### Via SQL
Check if files are being stored:
```sql
SELECT 
    id,
    issue_id,
    file_name,
    file_size,
    uploaded_by,
    created_at
FROM issue_attachments
ORDER BY created_at DESC
LIMIT 10;
```

Check storage bucket contents:
```sql
SELECT 
    name,
    bucket_id,
    created_at
FROM storage.objects
WHERE bucket_id = 'issue-attachments'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: "Bucket already exists"
**Solution**: The bucket was created successfully. Proceed to Step 2 (policies).

### Issue: "Policy already exists"
**Solution**: Policies are already set up. Verify with the query in Step 3.

### Issue: "No rows returned" when checking policies
**Solution**: 
1. Double-check the bucket name is exactly `issue-attachments`
2. Re-run the policy creation SQL
3. Ensure you're using the SQL Editor (not a regular migration)

### Issue: Upload fails with "Permission denied"
**Solutions**:
1. Verify the bucket is set to **public**: Go to Storage → issue-attachments → Settings → Public bucket should be ON
2. Check policies exist: Run the verification query from Step 3
3. Verify user is authenticated: Check `auth.users` table for the current user
4. Check RLS on `issue_attachments` table:
   ```sql
   SELECT * FROM issue_attachments WHERE issue_id = 'your-issue-id';
   ```

### Issue: Files upload but don't show in UI
**Solutions**:
1. Check if records are in `issue_attachments` table
2. Verify real-time subscription is working:
   ```sql
   SELECT * FROM issue_attachments WHERE issue_id = 'your-issue-id';
   ```
3. Check browser console for errors
4. Refresh the page

---

## Security Considerations

### Current Setup
- ✅ Bucket is public (allows direct access to files)
- ✅ Authentication required for all operations
- ✅ Policies enforce bucket-level access control
- ✅ Application enforces user-level access control via `issue_attachments` table

### Additional Security (Optional)
If you want stricter control:

**Make bucket private and use signed URLs:**
1. Set bucket to **private** in settings
2. Modify upload hook to generate signed URLs:
   ```typescript
   const { data } = supabase.storage
     .from('issue-attachments')
     .createSignedUrl(filePath, 3600); // 1 hour expiry
   ```
3. Store signed URL in `issue_attachments.file_url`

---

## File Organization

Files are organized by issue ID:
```
issue-attachments/
├── {issue-uuid-1}/
│   ├── 1706123456789-document.pdf
│   ├── 1706123457890-screenshot.png
│   └── 1706123458901-data.xlsx
├── {issue-uuid-2}/
│   ├── 1706123459012-report.docx
│   └── 1706123460123-image.jpg
└── {issue-uuid-3}/
    └── 1706123461234-spreadsheet.csv
```

This structure:
- ✅ Prevents file name conflicts
- ✅ Makes cleanup easy (delete entire folder when issue deleted)
- ✅ Provides logical organization
- ✅ Supports easy migration/backup

---

## Migration Execution Order

Run migrations in this order:
```sql
1. 20260727_issue_enhancements_complete.sql  -- Creates tables and functions
2. 20260727_create_issue_storage_bucket.sql  -- Creates bucket (policies commented out)
3. storage_policies_manual.sql               -- Creates storage policies (manual)
```

---

## Summary

✅ **Bucket**: `issue-attachments` (public, 50MB limit)  
✅ **Policies**: 3 policies for authenticated users (INSERT, SELECT, DELETE)  
✅ **Security**: RLS enabled on `issue_attachments` table  
✅ **Organization**: Files grouped by issue ID  
✅ **Real-time**: Updates propagate instantly via Supabase subscriptions  

Once setup is complete, users can:
- Upload files to issues (up to 50MB per file)
- Download attachments
- Delete their own attachments
- View attachment history in activity log
