# Communication Module - Drag & Drop Update ✅

## 🎯 What's New

### 1. #general Channel Now Visible ✅
- **Location**: Top of sidebar under "Universal" section
- **Always visible** to ALL users
- **Not part of any department**
- **Cannot be reordered** (stays at top)

### 2. Drag-and-Drop Department Reordering ✅
- **Users can reorder departments** according to their preference
- **Personal preference** - each user has their own order
- **Only departments** can be reordered (not channels, not #general)
- **Saved automatically** to database
- **Can be toggled** on/off in settings (coming soon)

---

## 🚀 Setup Steps

### Step 1: Apply User Preferences Migration

Run this in Supabase SQL Editor:

```sql
-- Copy contents from:
supabase/migrations/20260506000002_user_preferences.sql
```

This creates the `user_communication_preferences` table.

### Step 2: Create #general Channel (if not done)

Run this in Supabase SQL Editor:

```sql
-- Copy contents from:
SETUP_GENERAL_CHANNEL.sql
```

This creates the #general channel and adds all users as members.

### Step 3: Refresh Communication Page

- Go to `/communication`
- You should now see:
  - **#general** at the top under "Universal"
  - **Departments** below with drag handles
  - **"Drag to reorder"** hint

---

## 🎨 How It Works

### Universal Section
```
Universal
└── #general ← Always at top, visible to everyone
```

### Departments Section (Draggable)
```
Departments (Drag to reorder)
├── 🔘 Engineering    ← Drag handle
│   ├── #team-alpha
│   └── #project-x
├── 🔘 Sales          ← Drag handle
│   └── #leads
└── 🔘 Marketing      ← Drag handle
    └── #campaigns
```

---

## 📁 Files Created

1. ✅ `supabase/migrations/20260506000002_user_preferences.sql` - User preferences table
2. ✅ `src/components/communication/DepartmentSidebarWithDnD.tsx` - New sidebar with drag-and-drop
3. ✅ `src/components/pages/Communication.tsx` - Updated to use new sidebar
4. ✅ `COMMUNICATION_DND_UPDATE.md` - This file

---

## 🎯 Features

### Drag-and-Drop
- **Hover over department** → See grip handle (⋮⋮)
- **Click and drag** → Reorder departments
- **Release** → Order saved automatically
- **Personal preference** → Each user has their own order
- **Persists** → Order saved across sessions

### What Can Be Reordered
- ✅ **Departments** - Yes, drag to reorder
- ❌ **Channels** - No, stay in their department
- ❌ **#general** - No, always at top

### User Preferences Stored
```json
{
  "user_id": "user-uuid",
  "department_order": ["dept-1-uuid", "dept-2-uuid", "dept-3-uuid"],
  "enable_department_reordering": true
}
```

---

## 🔐 Permissions

### All Users
- ✅ Can see #general channel
- ✅ Can reorder departments (personal preference)
- ✅ Can expand/collapse departments
- ✅ Can click channels to open

### Admins
- ✅ All user permissions
- ✅ Can create departments
- ✅ Can delete departments
- ✅ Can create channels
- ✅ Can delete channels

---

## ⚙️ Settings (Coming Soon)

In user settings, you'll be able to:
- Toggle department reordering on/off
- Reset department order to default
- Customize notification preferences
- Set quiet hours

---

## 🐛 Troubleshooting

### Issue: #general not showing
**Solution**: 
1. Run `SETUP_GENERAL_CHANNEL.sql` in Supabase
2. Refresh the page
3. Check you're logged in

### Issue: Can't drag departments
**Solution**:
1. Check `enable_department_reordering` is true in preferences
2. Hover over department to see grip handle
3. Click and hold the grip handle, then drag

### Issue: Department order not saving
**Solution**:
1. Check migration `20260506000002_user_preferences.sql` was applied
2. Check browser console for errors
3. Verify RLS policies are enabled

### Issue: Drag handle not visible
**Solution**: Hover over the department name - the grip handle appears on hover

---

## 📊 Database Schema

### user_communication_preferences
```sql
CREATE TABLE user_communication_preferences (
    user_id UUID PRIMARY KEY,
    department_order JSONB DEFAULT '[]',
    enable_department_reordering BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### RLS Policies
- Users can only view/update their own preferences
- Automatic upsert on save
- Cascade delete when user is deleted

---

## 🎉 Complete Feature List

### ✅ Implemented
- [x] #general channel at top (universal)
- [x] Drag-and-drop department reordering
- [x] Personal user preferences
- [x] Auto-save order to database
- [x] Grip handle on hover
- [x] Visual feedback while dragging
- [x] Department deletion
- [x] Channel creation
- [x] Real-time messaging

### 🔜 Coming Soon
- [ ] Settings toggle for reordering
- [ ] Reset order to default
- [ ] Channel reordering within departments
- [ ] Favorite channels
- [ ] Custom channel groups

---

## 💡 Usage Tips

1. **Reorder departments** by dragging them up or down
2. **Your order is personal** - doesn't affect other users
3. **#general stays at top** - always accessible
4. **Channels stay in departments** - can't be moved between departments
5. **Order persists** - saved across sessions and devices

---

## 🚀 Next Steps

1. **Apply migrations** (Step 1 & 2 above)
2. **Refresh page** to see changes
3. **Try dragging** departments to reorder
4. **Create more departments** to test ordering
5. **Invite team members** to test multi-user experience

---

## ✅ Success Checklist

- [ ] Migration `20260506000002_user_preferences.sql` applied
- [ ] `SETUP_GENERAL_CHANNEL.sql` run successfully
- [ ] #general channel visible at top
- [ ] Can see grip handles on departments
- [ ] Can drag departments to reorder
- [ ] Order persists after refresh
- [ ] Real-time messaging works

---

**Last Updated**: May 6, 2026 at 12:25 AM

**Status**: ✅ Ready to use!
