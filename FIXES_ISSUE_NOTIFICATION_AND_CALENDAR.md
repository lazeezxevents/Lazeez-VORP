# Issue Creation & Calendar Navigation Fixes

**Date:** July 27, 2026  
**Status:** ✅ Complete

## Issues Fixed

### 1. ❌ Issue Creation Error: "record 'new' has no field 'created_by'"

**Problem:**
When creating a new issue, users were receiving the error:
```
Failed to create issue: record "new" has no field "created_by"
```

**Root Cause:**
The notification trigger `notify_issue_created()` in the database was referencing `NEW.created_by`, but the `issues` table uses `reported_by` instead of `created_by` for tracking who reported the issue.

**Solution:**
Created migration `supabase/migrations/20260727_fix_issue_notifications.sql` that:
- Updates `notify_issue_created()` function to use `NEW.reported_by` instead of `NEW.created_by`
- Updates `notify_issue_status_changed()` function to use `NEW.reported_by` instead of `NEW.created_by`
- Ensures all notification logic correctly references the `reported_by` field

**Files Changed:**
- ✅ Created: `supabase/migrations/20260727_fix_issue_notifications.sql`

---

### 2. ❌ Calendar MOU Vault Navigation

**Problem:**
When clicking on MOU Vault-related events in the calendar (vault expirations, termination deadlines, renewals), the navigation was redirecting to the wrong page (MOUs page instead of MOU Vault page).

**Root Cause:**
The calendar event click handler was using a generic `event.type.startsWith("vault")` check in an else clause, which meant MOU expiration events were being caught first and redirecting to `/mous` instead of allowing vault events to properly route to `/mou-vault`.

**Solution:**
Updated the calendar event click handler in `src/components/pages/Calendar.tsx` to explicitly check for vault event types:
- `vault_expiration` → navigate to `/mou-vault`
- `vault_termination` → navigate to `/mou-vault`
- `renewal` → navigate to `/mou-vault`
- `mou_expiration` → navigate to `/mous`

**Files Changed:**
- ✅ Modified: `src/components/pages/Calendar.tsx` (lines 647-656)

---

## Technical Details

### Database Schema (Issues Table)
```sql
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  reported_by UUID REFERENCES auth.users(id) NOT NULL,  -- ✅ This is the correct field
  due_date TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Fixed Notification Function (Excerpt)
```sql
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.reported_by);  -- ✅ Changed from NEW.created_by
  
  -- Notify assigned user
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.reported_by THEN
    PERFORM notify_users(
      ARRAY[NEW.assigned_to],
      CASE WHEN NEW.priority = 'critical' THEN 'error' 
           WHEN NEW.priority = 'high' THEN 'warning' 
           ELSE 'info' END,
      'issue',
      (creator_info->>'full_name') || ' assigned an Issue',
      NEW.title,
      'issue',
      NEW.id,
      '/issues',
      NEW.reported_by,  -- ✅ Changed from NEW.created_by
      jsonb_build_object(
        'avatar_url', creator_info->>'avatar_url',
        'priority', NEW.priority,
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Fixed Calendar Navigation (Excerpt)
```tsx
onClick={() => {
  if (event.type === "issue_due") {
    navigate("/issues");
  } else if (event.type === "payment") {
    navigate(`/vendors/${(event.originalData as any).vendor_id}`);
  } else if (event.type === "vault_expiration" || 
             event.type === "vault_termination" || 
             event.type === "renewal") {
    navigate("/mou-vault");  // ✅ Correctly routes vault events
  } else if (event.type === "mou_expiration") {
    navigate("/mous");  // ✅ MOU events go here
  }
}}
```

---

## Calendar Event Types

The calendar now correctly handles these event types:

| Event Type | Icon | Destination | Description |
|-----------|------|-------------|-------------|
| `mou_expiration` | 📄 FileText | `/mous` | MOU end date |
| `vault_expiration` | 📦 Archive | `/mou-vault` | Vault document expiration |
| `vault_termination` | ⚠️ AlertCircle | `/mou-vault` | Termination deadline |
| `renewal` | 🔄 RefreshCw | `/mou-vault` | Auto-renewal projection |
| `payment` | 💰 DollarSign | `/vendors/:id` | Vendor payment |
| `issue_due` | ⚠️ AlertCircle | `/issues` | Issue due date |

---

## How to Apply the Database Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/20260727_fix_issue_notifications.sql`
4. Copy the entire SQL content
5. Paste into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Supabase CLI (If installed locally)
```bash
cd c:\Users\SHUJA\Downloads\Lazeez-VORP
supabase db push
```

### Option 3: Manual Deployment
If deploying to production:
```bash
# Connect to your production database
psql -h your-db-host -U postgres -d postgres

# Run the migration file
\i supabase/migrations/20260727_fix_issue_notifications.sql
```

---

## Testing Checklist

### ✅ Issue Creation
- [ ] Create a new issue from the Issues page
- [ ] Verify the issue is created successfully without errors
- [ ] Verify the creator receives a notification
- [ ] Verify assigned users receive notifications
- [ ] Verify managers receive notifications

### ✅ Calendar Navigation
- [ ] Click on a "MOU Expiration" event → Should go to `/mous`
- [ ] Click on a "Vault Expiration" event → Should go to `/mou-vault`
- [ ] Click on a "Termination Deadline" event → Should go to `/mou-vault`
- [ ] Click on a "Renewal" event → Should go to `/mou-vault`
- [ ] Click on a "Payment" event → Should go to `/vendors/:id`
- [ ] Click on an "Issue Due" event → Should go to `/issues`

---

## Impact Assessment

### Database Changes
- **Low Risk**: Only updates function definitions, no schema changes
- **Backward Compatible**: Uses existing `reported_by` field correctly
- **No Data Loss**: No data modifications, only logic fixes

### Frontend Changes
- **Low Risk**: Only navigation logic update
- **No Breaking Changes**: All existing functionality preserved
- **Improved UX**: Users now land on the correct page

---

## Related Files

### Modified
- `src/components/pages/Calendar.tsx` - Fixed event navigation logic

### Created
- `supabase/migrations/20260727_fix_issue_notifications.sql` - Database fix for notifications
- `FIXES_ISSUE_NOTIFICATION_AND_CALENDAR.md` - This documentation

### Referenced
- `src/components/issues/IssueForm.tsx` - Issue creation form
- `src/components/hooks/useIssues.ts` - Issue CRUD hooks
- `supabase/migrations/20251217141914_e73895bb-5de0-4142-a852-adb7d5654d27.sql` - Original schema
- `supabase/migrations/20260319_comprehensive_notifications.sql` - Original notification system

---

## Notes

1. **Database Migration Required**: The database migration must be applied before the fix takes full effect
2. **Real-time Notifications**: Once the migration is applied, all issue notifications will work correctly
3. **Calendar Events**: The calendar navigation fix is already live in the frontend code
4. **No Breaking Changes**: These fixes are backward compatible and don't affect existing data

---

## Support

If you encounter any issues after applying these fixes:
1. Verify the migration was applied successfully in Supabase dashboard
2. Check the browser console for any JavaScript errors
3. Clear browser cache and refresh the page
4. Check the Supabase logs for any database errors

---

**Status:** ✅ Ready for deployment
