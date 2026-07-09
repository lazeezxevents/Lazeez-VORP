# Communication Module - Quick Start Guide

## 🚀 Getting Started

### Step 1: Fix #general Channel (If Not Showing)

If you can't see the #general channel in the sidebar:

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `FIX_GENERAL_CHANNEL.sql` from your project
4. Copy and paste the entire contents
5. Click **Run**
6. Wait for success message
7. **Refresh** the Communication page

### Step 2: Enable Department Reordering

1. Go to **Settings** (click your profile → Settings)
2. Click the **Communication** tab
3. Toggle **"Enable department reordering"** to ON
4. You can now drag departments to reorder them!

### Step 3: Start Using Communication

1. Open **Communication** page from sidebar
2. You should see:
   - **Universal** section with #general channel at top
   - **Departments** section below
3. Click **#general** to start messaging
4. Admins can click **"+"** to create departments

## 🎯 Key Features

### For All Users:
- ✅ View and message in #general channel
- ✅ View departments and channels you're a member of
- ✅ Drag departments to reorder (personal preference)
- ✅ Send and receive real-time messages
- ✅ Toggle department reordering in Settings

### For Admins:
- ✅ Create departments (click "+" button)
- ✅ Create channels within departments (click "⋮" menu)
- ✅ Delete departments (click "⋮" menu → Delete)
- ✅ Manage all channels and members

## 📋 Common Tasks

### Create a Department (Admin Only):
1. Click **"+"** button in Communication sidebar
2. Enter department name and description
3. Click **Create**

### Create a Channel (Admin Only):
1. Click **"⋮"** menu on a department
2. Select **"Create Channel"**
3. Enter channel name and details
4. Click **Create**

### Delete a Department (Admin Only):
1. Click **"⋮"** menu on a department
2. Select **"Delete Department"**
3. Review warning (shows channel count)
4. Confirm deletion

### Reorder Departments:
1. Ensure reordering is enabled in Settings → Communication
2. Hover over a department
3. Drag the **grip handle** (⋮⋮) that appears
4. Drop in desired position
5. Order is saved automatically

### Disable Department Reordering:
1. Go to Settings → Communication
2. Toggle **"Enable department reordering"** to OFF
3. Departments will use default alphabetical order

## 🐛 Troubleshooting

### #general Channel Not Showing:
**Solution**: Run `FIX_GENERAL_CHANNEL.sql` in Supabase SQL Editor

### Can't Drag Departments:
**Solution**: Check Settings → Communication → Enable department reordering is ON

### No Departments Showing:
**Solution**: Admin needs to create departments first (click "+" button)

### Messages Not Sending:
**Solution**: Check browser console for errors, verify you're a channel member

## 📊 What's Stored in Database

### Your Personal Preferences:
- Department order (array of department IDs)
- Enable/disable reordering toggle
- Stored in `user_communication_preferences` table

### Communication Data:
- Departments (shared by all users)
- Channels (within departments)
- Messages (in channels)
- Channel memberships (who can see what)

## 🎨 UI Layout

```
Communication Sidebar:
├── Universal
│   └── #general (always at top, cannot reorder)
├── Departments
│   ├── Department 1 (can drag to reorder)
│   │   ├── #channel-1
│   │   ├── #channel-2
│   │   └── #channel-3
│   ├── Department 2 (can drag to reorder)
│   │   ├── #team-alpha
│   │   └── #team-beta
│   └── Department 3 (can drag to reorder)
│       └── #projects
└── Footer
    ├── Direct Messages (coming soon)
    └── Settings
```

## ⚙️ Settings Location

**Path**: Settings → Communication tab

**Options**:
- Enable department reordering (toggle)
- Info about how reordering works

## 🔐 Permissions

| Action | Admin | Manager | Employee |
|--------|-------|---------|----------|
| View #general | ✅ | ✅ | ✅ |
| Send messages | ✅ | ✅ | ✅ |
| Create departments | ✅ | ❌ | ❌ |
| Delete departments | ✅ | ❌ | ❌ |
| Create channels | ✅ | ✅ | ❌ |
| Reorder departments | ✅ | ✅ | ✅ |

## 📝 Notes

- **#general** is visible to ALL users automatically
- **Department order** is personal (doesn't affect other users)
- **Channels** stay in their departments (cannot be reordered)
- **Deleting a department** also deletes all its channels and messages
- **Real-time updates** happen automatically (no refresh needed)

## 🎉 You're All Set!

The Communication Module is ready to use. If you encounter any issues, refer to the troubleshooting section or check `COMMUNICATION_MODULE_COMPLETE.md` for detailed technical information.

**Happy messaging! 💬**
