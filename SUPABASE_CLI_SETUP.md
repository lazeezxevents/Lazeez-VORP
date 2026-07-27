# 🚀 Supabase CLI Setup & Database Push

## ✅ Supabase CLI is Installed!

Version: 2.109.1 ✓

---

## 📋 Step 1: Link Your Project

Run this command in PowerShell (in your project directory):

```powershell
cd c:\Users\SHUJA\Downloads\Lazeez-VORP
supabase link --project-ref YOUR_PROJECT_REF
```

**How to get YOUR_PROJECT_REF**:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "Settings" → "General"
4. Copy the "Reference ID" (looks like: `mdxuyoklqiwjdeigbuzy`)

**Example**:
```powershell
supabase link --project-ref mdxuyoklqiwjdeigbuzy
```

It will ask for your database password - enter it when prompted.

---

## 📋 Step 2: Push the Migration

After linking, run:

```powershell
supabase db push
```

This will:
- ✅ Detect the new migration: `20260728_complete_issue_enhancements.sql`
- ✅ Apply it to your remote database
- ✅ Create all 8 tables for issue enhancements
- ✅ Set up RLS policies
- ✅ Enable real-time
- ✅ Create storage bucket
- ✅ Add auto-timer triggers

---

## 📋 Step 3: Verify It Worked

Run this to see migration status:

```powershell
supabase migration list
```

You should see:
```
20260728_complete_issue_enhancements | Applied | <timestamp>
```

---

## 🎯 What Gets Created

After `supabase db push`, you'll have:

**Tables**:
- ✅ issue_activity (remarks/comments)
- ✅ issue_watchers
- ✅ issue_chat_messages (team chat)
- ✅ issue_attachments
- ✅ issue_time_logs
- ✅ issue_labels
- ✅ issue_label_relations
- ✅ issue_timers (auto-timer)

**Features**:
- ✅ All RLS policies
- ✅ Real-time subscriptions
- ✅ Storage bucket (50MB limit)
- ✅ Auto-timer triggers
- ✅ Default labels

---

## 🐛 Troubleshooting

### Error: "Project not linked"
**Solution**: Run Step 1 again with correct project ref

### Error: "Invalid project ref"
**Solution**: Double-check the Reference ID from Supabase dashboard

### Error: "Authentication required"
**Solution**: Run `supabase login` first, then try linking again

### Error: "Migration already applied"
**Solution**: Migration is already in your database - you're done! ✓

---

## 📝 Quick Reference

```powershell
# Login to Supabase
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Check status
supabase migration list

# View remote DB
supabase db remote ls
```

---

## ✨ Done!

After `supabase db push` completes:
- All issue enhancement features will work
- No more "table doesn't exist" errors
- Watchers, Chat, Remarks, Attachments, Time Tracking all functional

**That's it!** 🎉
