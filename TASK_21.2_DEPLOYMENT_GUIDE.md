# Task 21.2: Channel Muting - Deployment Guide

## Overview
This guide explains how to deploy the channel muting feature to production.

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Access to Supabase project
- Database backup (recommended)

## Deployment Steps

### 1. Apply Database Migration

The migration file is located at:
```
supabase/migrations/20260509120000_muted_channels.sql
```

#### Option A: Using Supabase CLI (Recommended)

```bash
# Link to your Supabase project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push the migration to production
npx supabase db push
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20260509120000_muted_channels.sql`
4. Paste and execute the SQL

### 2. Regenerate TypeScript Types

After applying the migration, regenerate the TypeScript types:

```bash
# For local development
npx supabase gen types typescript --local > src/components/integrations/supabase/types.ts

# For production
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/components/integrations/supabase/types.ts
```

### 3. Update Code

After regenerating types, update `src/hooks/useMutedChannels.ts`:

Remove the `(supabase as any)` type assertions and replace with proper typed calls:

```typescript
// Before (temporary workaround)
const { data, error } = await (supabase as any)
  .from('muted_channels')
  .select('channel_id, muted_at')
  .eq('user_id', userId);

// After (with regenerated types)
const { data, error } = await supabase
  .from('muted_channels')
  .select('channel_id, muted_at')
  .eq('user_id', userId);
```

### 4. Run Tests

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- mutedChannels.test.tsx
```

### 5. Type Check

```bash
npm run typecheck
```

### 6. Build

```bash
npm run build
```

### 7. Deploy

Deploy the application using your deployment method (Vercel, Netlify, etc.)

## Verification

After deployment, verify the feature works:

1. **Test Muting:**
   - Log in to the application
   - Navigate to Communication module
   - Hover over a channel
   - Click the three-dot menu
   - Click "Mute channel"
   - Verify BellOff icon appears
   - Verify toast notification

2. **Test Unmuting:**
   - Hover over a muted channel
   - Click the three-dot menu
   - Click "Unmute channel"
   - Verify BellOff icon disappears
   - Verify toast notification

3. **Test Database:**
   - Check `muted_channels` table in Supabase dashboard
   - Verify records are created/deleted correctly
   - Verify RLS policies work (users can only see their own muted channels)

4. **Test Notifications:**
   - Send a message in a muted channel
   - Verify no notification is sent
   - Send a message with @mention in a muted channel
   - Verify notification IS sent

## Rollback Plan

If issues occur, rollback the migration:

```sql
-- Drop the muted_channels table
DROP TABLE IF EXISTS public.muted_channels CASCADE;
```

Then redeploy the previous version of the application.

## Monitoring

Monitor the following after deployment:

1. **Database Performance:**
   - Check query performance on `muted_channels` table
   - Monitor index usage
   - Watch for slow queries

2. **User Adoption:**
   - Track how many users mute channels
   - Monitor which channels are most frequently muted
   - Gather user feedback

3. **Error Logs:**
   - Monitor application logs for errors related to muting
   - Check Supabase logs for database errors
   - Watch for RLS policy violations

## Troubleshooting

### Issue: TypeScript errors after migration

**Solution:** Regenerate types as described in step 2

### Issue: RLS policy errors

**Solution:** Verify user is authenticated and is a member of the channel they're trying to mute

### Issue: Mute status not syncing across devices

**Solution:** Check TanStack Query cache invalidation and Supabase real-time subscriptions

### Issue: Notifications still sent for muted channels

**Solution:** Verify notification service checks `isChannelMuted()` before sending notifications

## Support

For issues or questions:
1. Check the implementation summary: `src/components/communication/TASK_21.2_IMPLEMENTATION_SUMMARY.md`
2. Review the test file: `src/components/communication/__tests__/mutedChannels.test.tsx`
3. Check Supabase logs in the dashboard
4. Contact the development team

## Checklist

- [ ] Database migration applied
- [ ] TypeScript types regenerated
- [ ] Code updated (removed type assertions)
- [ ] Tests passing
- [ ] Type check passing
- [ ] Build successful
- [ ] Application deployed
- [ ] Feature verified in production
- [ ] Monitoring set up
- [ ] Team notified

## Notes

- The migration is non-destructive and can be safely applied
- Existing data is not affected
- Users will see the new feature immediately after deployment
- No user action required to enable the feature
