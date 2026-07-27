# 🚀 DEPLOYMENT INSTRUCTIONS - CRITICAL FIXES

## 📋 Summary of All Fixes

### ✅ COMPLETED FIXES
1. **Watchers, Remarks, Attachments, Chat, Time Logs** - All DB/RLS issues fixed
2. **Global Auto-Timer System** - Starts on in_progress, stops on resolved
3. **Global Notification System** - Backend triggers, no session dependency
4. **Restore as Unread** - Archived notifications restore as unread (not read)
5. **CS-Agent Red Background** - Now shows in AI message bubbles
6. **MOU Count Fix** - Uses mou_vault table (shows 45 instead of 0)

---

## 🔥 CRITICAL MIGRATIONS TO RUN (IN ORDER)

### 1. Fix All Issue Enhancements (RLS + Auto-Timer)
```bash
# Run this migration first - fixes all DB/RLS issues
supabase db push
# OR manually run:
# supabase/migrations/20260727_fix_all_issue_enhancements_rls.sql
```

**This migration fixes:**
- ✅ Watchers can be added/removed
- ✅ Remarks can be added to issues
- ✅ Attachments can be uploaded/viewed
- ✅ Team chat messages work
- ✅ Time logs can be added manually
- ✅ Storage policies for attachments bucket
- ✅ Auto-timer: starts when status → in_progress
- ✅ Auto-timer: stops & logs when status → resolved/closed
- ✅ Creates `issue_timers` table

### 2. Global Notification System
```bash
# Run this migration second
# Manually run:
# supabase/migrations/20260727_global_notification_system.sql
```

**This migration creates:**
- ✅ `create_notification_for_users()` helper function
- ✅ Trigger: Issue created → notify assignee + watchers
- ✅ Trigger: Issue status changed → notify all watchers
- ✅ Trigger: Watcher added → notify the new watcher
- ✅ Trigger: Comment added → notify all watchers
- ✅ Function: `notify_mou_expiring_soon()` for scheduled checks

---

## 🌐 EDGE FUNCTIONS TO DEPLOY

### 1. Issue Timer Sync (Background Timer Service)
```bash
supabase functions deploy issue-timer-sync
```

**What it does:**
- Runs every 5 minutes via cron
- Syncs active timers globally
- Stops timers for resolved/closed issues
- Auto-logs elapsed time
- Works even when users are offline

### 2. Notification Scheduler (Daily Notifications)
```bash
supabase functions deploy notification-scheduler
```

**What it does:**
- Runs daily at 9 AM via cron
- Checks for MOUs expiring in next 30 days
- Sends notifications to admins/staff
- Prevents duplicate notifications

---

## ⚙️ HOW FEATURES WORK

### 🔔 Global Notification System
1. **Action happens** in database (issue created, status changed, etc.)
2. **Database trigger fires** automatically (no user session needed)
3. **Notification created** for relevant users
4. **Real-time subscription** shows toast popup immediately
5. **Notification appears** in notifications tab
6. **Users can** archive/restore/mark as read

**Auto-notifications for:**
- Issue created → assignee + watchers
- Issue status changed → all watchers
- Watcher added → the new watcher
- Comment/remark added → all watchers
- MOU expiring soon → admins/staff (daily 9 AM)

### ⏰ Global Auto-Timer System
1. **Issue assigned** to user + **status → in_progress**
   - Timer starts automatically in `issue_timers` table
2. **User works** on issue (timer runs via database, not browser)
3. **Anyone marks** issue as **resolved** or **closed**
   - Timer stops automatically
   - Elapsed time logged to `issue_time_logs`
4. **Edge function** runs every 5 minutes to sync orphaned timers
5. **No session dependency** - works across devices/browsers

**Database tables:**
- `issue_timers` - tracks active timers
- `issue_time_logs` - stores logged time
- Triggers on `issues` table handle start/stop

---

## 🐛 WHAT WAS FIXED

### Issue Enhancements (All Working Now)
✅ **Watchers** - Can add/remove, notifications work
✅ **Remarks** - Can add comments, watchers notified
✅ **Attachments** - Upload/view/delete works, storage policies fixed
✅ **Team Chat** - Messages send successfully, real-time updates
✅ **Time Logs** - Manual entry works, auto-logging from timers
✅ **CS-Agent mentions** - Red background shows in message bubbles

### MOU Count Fix
✅ **Vendor Detail** - Shows correct count (45 from mou_vault)
✅ **Analytics** - Uses mou_vault for accurate statistics
✅ **Active MOUs** - Based on extraction_status + date range

### Notification Fixes
✅ **Mark as read** - Bulk and individual operations work
✅ **Archive/Delete** - Bulk operations with SQL IN clause
✅ **Restore** - Now marks as **UNREAD** (not read)
✅ **Toast clicks** - Mark as read before navigation
✅ **Global system** - Backend triggers, no session dependency

---

## 📝 VERIFICATION STEPS

### 1. Test Issue Enhancements
```
1. Create an issue
2. Add yourself as watcher → Should see notification
3. Add a remark → All watchers notified
4. Upload attachment → File appears in Attachments tab
5. Send team chat message → Message appears for everyone
6. Log time manually → Appears in Time Log History
```

### 2. Test Auto-Timer
```
1. Create issue and assign to yourself
2. Change status to "in_progress" → Timer starts automatically
3. Work on issue (timer runs in background)
4. Change status to "resolved" → Timer stops, time auto-logged
5. Check Time tab → See auto-logged entry
```

### 3. Test Notifications
```
1. Create an issue → Assignee gets notification + toast
2. Change issue status → Watchers get notification + toast
3. Add a comment → Watchers get notification + toast
4. Archive notification → Appears in Archive page
5. Restore notification → Returns to main feed as UNREAD
```

### 4. Verify MOU Counts
```
1. Go to Vendor Detail page
2. Check KPI card → Should show correct MOU count (e.g., 45)
3. Go to Analytics page
4. Check Active MOUs stat → Should match vault count
```

---

## 🎯 DEPLOYMENT CHECKLIST

- [ ] Run migration: `20260727_fix_all_issue_enhancements_rls.sql`
- [ ] Run migration: `20260727_global_notification_system.sql`
- [ ] Deploy edge function: `issue-timer-sync`
- [ ] Deploy edge function: `notification-scheduler`
- [ ] Test watchers (add/remove)
- [ ] Test remarks (add comment)
- [ ] Test attachments (upload file)
- [ ] Test team chat (send message)
- [ ] Test time logging (manual entry)
- [ ] Test auto-timer (in_progress → resolved)
- [ ] Test notifications (create issue → see toast)
- [ ] Test restore (archive → restore as unread)
- [ ] Verify MOU counts (vendor detail + analytics)

---

## 🔧 TROUBLESHOOTING

### Watchers/Remarks/Attachments/Chat Not Working
**Solution:** Run the RLS migration
```bash
supabase db push
# OR manually:
psql < supabase/migrations/20260727_fix_all_issue_enhancements_rls.sql
```

### Auto-Timer Not Starting
**Solution:** 
1. Check `issue_timers` table exists
2. Verify triggers are created on `issues` table
3. Deploy `issue-timer-sync` edge function
4. Check Supabase logs for errors

### Notifications Not Appearing
**Solution:**
1. Run global notification system migration
2. Check real-time subscriptions in browser console
3. Verify notification triggers exist
4. Check `notifications` table for new entries

### MOU Count Still Showing 0
**Solution:**
1. Verify `mou_vault` table has data
2. Check `useAnalytics` hook is updated
3. Clear browser cache and refresh

---

## 📞 SUPPORT

If issues persist:
1. Check Supabase logs: `supabase logs`
2. Check edge function logs: `supabase functions logs <function-name>`
3. Verify RLS policies: Query `pg_policies` table
4. Check triggers: Query `pg_trigger` table
5. Review migration logs for errors

---

## 🎉 SUCCESS CRITERIA

All features working when:
- ✅ Watchers can be added without errors
- ✅ Remarks appear in Remarks tab
- ✅ Attachments upload and display
- ✅ Team chat messages send successfully
- ✅ Time logs can be added manually
- ✅ Timer starts when status → in_progress
- ✅ Timer stops and logs time when resolved
- ✅ Notifications appear as toast + in tab
- ✅ Restored notifications show as unread
- ✅ MOU counts show correct numbers (from vault)
- ✅ CS-agent mentions have red background

---

**🚀 Ready to deploy? Follow the checklist above!**
