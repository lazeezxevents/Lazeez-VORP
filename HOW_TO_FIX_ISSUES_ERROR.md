# Fix: "Could not find the 'project_id' column of 'issues' in the schema cache"

## Problem
The `issues` table is missing the `project_id` and `project_task_id` columns that the application code expects.

## Solution
You need to run the SQL migration to add these columns to your database.

### Option 1: Supabase Dashboard (Recommended - Easiest)

1. **Go to your Supabase Dashboard**
   - Open https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Copy the contents of `FIX_ISSUES_PROJECT_COLUMNS.sql` file
   - Paste it into the SQL editor
   - Click "Run" or press Ctrl+Enter

4. **Verify**
   - The last SELECT statement will show you the columns were added
   - You should see two rows: `project_id` and `project_task_id`

### Option 2: Supabase CLI (If you have it installed)

1. **Install Supabase CLI** (if not already installed):
   ```powershell
   # Using Scoop
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   
   # OR using npm
   npm install -g supabase
   ```

2. **Link to your project**:
   ```powershell
   supabase link --project-ref your-project-ref
   ```

3. **Push the migration**:
   ```powershell
   supabase db push
   ```

### Option 3: Direct SQL Execution

If you have direct database access (connection string), run this SQL:

```sql
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_task_id ON public.issues(project_task_id);
```

## What This Does

- **Adds `project_id` column**: Links issues to projects (optional)
- **Adds `project_task_id` column**: Links issues to specific project tasks (optional)
- **Creates indexes**: Improves query performance when filtering by these columns
- **Safe to run multiple times**: Uses `IF NOT EXISTS` checks

## After Running the Migration

1. **Refresh your application** - The error should be gone
2. **Test issue creation** - Try creating a new issue
3. **Test project linking** - You can now link issues to projects and tasks

## Technical Details

The migration already exists in your codebase at:
- `supabase/migrations/20260724_issue_project_assignment_links.sql`

It just needs to be applied to your live database.

## Troubleshooting

### If you still get the error after running the migration:

1. **Clear browser cache** - The schema cache might be stale
2. **Restart your dev server** - `npm run dev` or reload the page
3. **Check the database** - Verify columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'issues' AND table_schema = 'public';
   ```

### If you see permission errors:

Make sure you're logged in as a user with database admin permissions (usually the project owner).
