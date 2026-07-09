# Design Document: Notification System Fixes

## Overview

This design addresses four critical issues in the Lazeez VORP notification system: (1) the designation dropdown incorrectly queries a legacy table instead of the custom_roles table, (2) notification sounds are not integrated with the existing Sound_Manager singleton, (3) the archive functionality lacks visible UI controls, and (4) notification actions have unnecessary permission restrictions preventing non-admin users from managing their notifications.

The fixes ensure proper integration with the two-layer role system (main_role + custom_roles), leverage the existing sound infrastructure, provide intuitive archive controls, and enable permission-free notification management for all authenticated users.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Notification System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  Notifications   │      │  Profile         │                │
│  │  Component       │      │  Settings        │                │
│  └────────┬─────────┘      └────────┬─────────┘                │
│           │                          │                           │
│           │                          │                           │
│  ┌────────▼─────────┐      ┌────────▼─────────┐                │
│  │ useNotifications │      │ useDesignations  │                │
│  │ Hook             │      │ Hook             │                │
│  └────────┬─────────┘      └────────┬─────────┘                │
│           │                          │                           │
│           │                          │                           │
│  ┌────────▼──────────────────────────▼─────────┐                │
│  │         Supabase Client Layer               │                │
│  │  - Real-time subscriptions                  │                │
│  │  - Query: custom_roles table                │                │
│  │  - Query: notifications table                │                │
│  └─────────────────────────────────────────────┘                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Sound System                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  Notifications   │      │  Notification    │                │
│  │  Component       │◄─────┤  Sound Prefs     │                │
│  └────────┬─────────┘      └──────────────────┘                │
│           │                                                       │
│           │ playSound(type, config)                             │
│           │                                                       │
│  ┌────────▼─────────┐                                           │
│  │  Sound_Manager   │                                           │
│  │  (Singleton)     │                                           │
│  │                  │                                           │
│  │  - play()        │                                           │
│  │  - setEnabled()  │                                           │
│  │  - audioCache    │                                           │
│  └────────┬─────────┘                                           │
│           │                                                       │
│           │ HTMLAudioElement                                    │
│           │                                                       │
│  ┌────────▼─────────┐                                           │
│  │  Embedded Audio  │                                           │
│  │  Data URIs       │                                           │
│  └──────────────────┘                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow


#### Designation Dropdown Flow

```
User loads Profile Settings
    ↓
useDesignations() hook executes
    ↓
Query: SELECT * FROM custom_roles ORDER BY display_name
    ↓
Map results to dropdown options
    ↓
Display: custom_roles.display_name
Store: custom_roles.id → profiles.designation_id
    ↓
Pre-select if user.designation_id matches custom_role.id
```

#### Notification Sound Flow

```
Event occurs (notification arrives, button clicked, etc.)
    ↓
Component calls: playSound(soundType, config)
    ↓
Sound_Manager checks: enabled flag
    ↓
If enabled:
    - Get cached HTMLAudioElement
    - Apply volume from config
    - Play sound
If disabled:
    - Silently return (no-op)
```

#### Archive Action Flow

```
User hovers over notification
    ↓
Archive button appears (amber color, Archive icon)
    ↓
User clicks archive button
    ↓
handleDelete(notificationId) called
    ↓
Add to deletedItems Set in localStorage
    ↓
Filter notification from visible list
    ↓
Display toast: "Notification archived"
    ↓
Play archive sound
```


## Components and Interfaces

### Modified Components

#### 1. useDesignations Hook

**Location:** `src/components/hooks/useUsers.ts`

**Current Implementation:**
```typescript
export function useDesignations() {
  return useQuery({
    queryKey: ["designations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designations")  // ❌ Legacy table
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Designation[];
    },
  });
}
```

**New Implementation:**
```typescript
export function useDesignations() {
  return useQuery({
    queryKey: ["custom-roles"],  // Updated cache key
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")  // ✅ New table
        .select("id, name, display_name, description, main_role")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data as CustomRole[];
    },
  });
}
```

**Interface:**
```typescript
interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  main_role: 'admin' | 'manager' | 'employee';
  department_id?: string | null;
  permissions?: Record<string, boolean>;
}
```


#### 2. ProfileSettings Component

**Location:** `src/components/settings/ProfileSettings.tsx`

**Changes Required:**

1. Update dropdown rendering to use `display_name`:
```typescript
<SelectContent>
  {designations?.map((role) => (
    <SelectItem key={role.id} value={role.id}>
      {role.display_name}  {/* Changed from role.name */}
    </SelectItem>
  ))}
</SelectContent>
```

2. Add empty state handling:
```typescript
<SelectContent>
  {!designations || designations.length === 0 ? (
    <SelectItem value="" disabled>
      No designations available
    </SelectItem>
  ) : (
    designations.map((role) => (
      <SelectItem key={role.id} value={role.id}>
        {role.display_name}
      </SelectItem>
    ))
  )}
</SelectContent>
```

3. Ensure value binding uses `custom_roles.id`:
```typescript
<Select
  value={formData.designation_id}  // Already correct
  onValueChange={(value) => 
    setFormData({ ...formData, designation_id: value })
  }
>
```


#### 3. Notifications Component

**Location:** `src/components/pages/Notifications.tsx`

**Changes Required:**

1. **Replace local playSound with Sound_Manager:**

Current (lines 87-93):
```typescript
const playSound = (soundName: string) => {
  try {
    const audio = new Audio(`/sounds/${soundName}.mp3`);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch(e) { /* ignore */ }
};
```

New:
```typescript
import { playSound } from "@/components/utils/soundEffects";
// Remove local playSound function entirely
```

2. **Update all playSound calls to use correct sound types:**

```typescript
// Current: playSound("pop")
// New: playSound("click")

// Current: playSound("success")
// New: playSound("success")  // Already correct

// Current: playSound("delete")
// New: playSound("error")

// Current: playSound("archive")
// New: playSound("warning")

// Current: playSound("click")
// New: playSound("click")  // Already correct

// Current: playSound("refresh")
// New: playSound("refresh")  // Already correct

// Current: playSound("download")
// New: playSound("success")
```


3. **Add archive button to notification hover actions:**

The component currently has a truncated section around line 700+ where hover actions are defined. Add archive button:

```typescript
<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
  {!isRead && (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        handleMarkAsRead(notification.id);
        playSound("success");
      }}
      className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
      title="Mark as read"
    >
      <Check className="w-3.5 h-3.5" />
    </motion.button>
  )}
  
  {/* NEW: Archive button */}
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(notification.id);
      playSound("warning");
      toast.success("Notification archived");
    }}
    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors"
    title="Archive"
  >
    <Archive className="w-3.5 h-3.5" />
  </motion.button>
  
  {/* Existing delete button (if present) */}
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(notification.id);
      playSound("error");
    }}
    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
    title="Delete"
  >
    <Trash2 className="w-3.5 h-3.5" />
  </motion.button>
</div>
```


4. **Add real-time notification sound playback:**

In the `useNotifications` hook (or within the Notifications component if subscription is there), add sound playback when new notifications arrive:

```typescript
// In useNotifications hook or component effect
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      },
      (payload) => {
        // Existing: invalidate query cache
        queryClient.invalidateQueries(['unified-notifications']);
        
        // NEW: Play notification sound
        const preferences = getUIPreferences();
        if (preferences.enable_sound) {
          const soundType = preferences.notification_sound_type || 'notification';
          playSound(soundType as SoundType);
        }
        
        // NEW: Show popup if enabled
        if (preferences.enable_popup_alerts) {
          const notification = payload.new as Notification;
          toast(notification.message, {
            description: notification.title,
            action: notification.action_url ? {
              label: "View",
              onClick: () => navigate(notification.action_url)
            } : undefined
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id]);
```


#### 4. NotificationSoundPreferences Component

**Location:** `src/components/settings/NotificationSoundPreferences.tsx`

**Changes Required:**

1. **Connect enable_sound toggle to Sound_Manager:**

```typescript
import { setSoundEnabled } from "@/components/utils/soundEffects";

// In the component
const handleSoundToggle = (enabled: boolean) => {
  updatePreferences({ enable_sound: enabled });
  setSoundEnabled(enabled);  // NEW: Immediately update Sound_Manager
};

<Switch
  checked={preferences.enable_sound}
  onCheckedChange={handleSoundToggle}
/>
```

2. **Connect volume slider to Sound_Manager:**

The volume is already stored in preferences and passed to `playSound()` via config. Ensure all playSound calls read from preferences:

```typescript
// When playing sounds, always pass volume config
const preferences = getUIPreferences();
playSound('notification', { volume: preferences.sound_volume });
```

3. **Implement Test button:**

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const preferences = getUIPreferences();
    playSound(
      preferences.notification_sound_type as SoundType,
      { volume: preferences.sound_volume }
    );
  }}
>
  Test sound
</Button>
```


#### 5. useNotifications Hook

**Location:** `src/hooks/useNotifications.ts`

**Changes Required:**

1. **Remove permission checks from notification actions:**

Current implementation likely has checks like:
```typescript
const handleDelete = (id: string) => {
  if (!isAdmin && !isStaff) return;  // ❌ Remove this
  // ... delete logic
};
```

New implementation:
```typescript
const handleDelete = (id: string) => {
  // ✅ No permission check - all users can manage their notifications
  const deleted = new Set(getDeletedItems());
  deleted.add(id);
  localStorage.setItem('lazeez-deleted-notifications', JSON.stringify([...deleted]));
  setDeletedItems(deleted);
};
```

2. **Ensure localStorage persistence for all actions:**

```typescript
// Read state
const handleMarkAsRead = (id: string) => {
  const read = new Set(readItems);
  read.add(id);
  localStorage.setItem('lazeez-read-notifications', JSON.stringify([...read]));
  setReadItems(read);
};

// Delete state
const handleDelete = (id: string) => {
  const deleted = new Set(deletedItems);
  deleted.add(id);
  localStorage.setItem('lazeez-deleted-notifications', JSON.stringify([...deleted]));
  setDeletedItems(deleted);
};

// Bulk operations
const handleMarkAllAsRead = (ids: string[]) => {
  const read = new Set(readItems);
  ids.forEach(id => read.add(id));
  localStorage.setItem('lazeez-read-notifications', JSON.stringify([...read]));
  setReadItems(read);
};
```

3. **Add optimistic UI updates:**

All state updates should immediately reflect in the UI without waiting for server responses (which don't exist for these client-side-only operations).


### New Utility Functions

#### getUIPreferences Helper

**Location:** `src/hooks/useNotificationUIPreferences.ts` or create new utility file

```typescript
export interface UIPreferences {
  enable_sound: boolean;
  sound_volume: number;
  notification_sound_type: 'notification' | 'bell_ring' | 'success';
  enable_popup_alerts: boolean;
  enable_click_sounds: boolean;
  enable_hover_sounds: boolean;
  enable_system_sounds: boolean;
}

export const getUIPreferences = (): UIPreferences => {
  const stored = localStorage.getItem('lazeez-notification-ui-preferences');
  if (!stored) {
    return {
      enable_sound: true,
      sound_volume: 0.4,
      notification_sound_type: 'notification',
      enable_popup_alerts: true,
      enable_click_sounds: true,
      enable_hover_sounds: false,
      enable_system_sounds: true,
    };
  }
  return JSON.parse(stored);
};
```


## Data Models

### custom_roles Table Schema

```sql
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  main_role VARCHAR(50) NOT NULL CHECK (main_role IN ('admin', 'manager', 'employee')),
  department_id UUID REFERENCES departments(id),
  permissions JSONB DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `id`: UUID primary key (stored in profiles.designation_id)
- `name`: Internal identifier (e.g., "sales_executive")
- `display_name`: User-facing label (e.g., "Sales Executive")
- `main_role`: Base permission level (admin/manager/employee)
- `permissions`: Granular permission overrides

### profiles Table (Relevant Fields)

```sql
-- Existing fields
designation_id UUID REFERENCES custom_roles(id)
```

The `designation_id` field should reference `custom_roles.id`, not the legacy `designations` table.

### LocalStorage Schema

#### Notification Read State
```typescript
// Key: 'lazeez-read-notifications'
// Value: JSON array of notification IDs
["uuid-1", "uuid-2", "uuid-3"]
```

#### Notification Deleted State
```typescript
// Key: 'lazeez-deleted-notifications'
// Value: JSON array of notification IDs
["uuid-4", "uuid-5"]
```

#### UI Preferences
```typescript
// Key: 'lazeez-notification-ui-preferences'
// Value: JSON object
{
  "enable_sound": true,
  "sound_volume": 0.4,
  "notification_sound_type": "notification",
  "enable_popup_alerts": true,
  "enable_click_sounds": true,
  "enable_hover_sounds": false,
  "enable_system_sounds": true
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Designation dropdown displays custom_roles data

*For any* Profile Settings page load, the designation dropdown should fetch and display only records from the custom_roles table, showing the display_name field for each option.

**Validates: Requirements 1.1, 1.2, 1.5, 1.7**

### Property 2: Designation selection round-trip

*For any* custom_role selected in the designation dropdown, the stored designation_id in the profiles table should equal the custom_roles.id of the selected role.

**Validates: Requirements 1.3**

### Property 3: Designation dropdown pre-selection

*For any* user with a non-null designation_id, when the Profile Settings page loads, the designation dropdown should pre-select the custom_role whose id matches the user's designation_id.

**Validates: Requirements 1.6**

### Property 4: Sound_Manager respects enable_sound preference

*For any* sound playback attempt, if the enable_sound preference is false, the Sound_Manager should silently ignore the play() call without playing audio or throwing errors.

**Validates: Requirements 2.4, 2.6, 5.7**

### Property 5: Sound_Manager applies volume preference

*For any* sound played by the Sound_Manager, the audio volume should match the sound_volume value from UI preferences.

**Validates: Requirements 2.5**

### Property 6: Notification arrival triggers sound

*For any* new notification inserted for the current user, if enable_sound is true, the Notification_System should play the sound type specified in notification_sound_type preference.

**Validates: Requirements 2.1, 2.7, 6.1**


### Property 7: Action buttons trigger appropriate sounds

*For any* notification action (mark read, archive, delete, bulk operations), the Notification_System should play the corresponding sound effect (success for mark read, warning for archive, error for delete).

**Validates: Requirements 2.3, 2.9**

### Property 8: Archive button visibility on hover

*For any* notification item, when the user hovers over it, an archive button with amber styling and Archive icon should appear in the hover action area.

**Validates: Requirements 3.1**

### Property 9: Archive action removes notification

*For any* notification, when the archive button is clicked, the notification should be added to deletedItems localStorage Set and immediately removed from the visible notification list.

**Validates: Requirements 3.2, 3.7**

### Property 10: Archive action shows confirmation

*For any* notification archived, a toast message "Notification archived" should be displayed.

**Validates: Requirements 3.3**

### Property 11: All users can manage notifications

*For any* authenticated user (regardless of role), all notification management actions (mark read, delete, archive, bulk operations) should execute successfully without permission checks.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

### Property 12: Notification state persistence round-trip

*For any* notification marked as read or deleted, the notification ID should be stored in the corresponding localStorage Set (readItems or deletedItems), and subsequent page loads should reflect this state.

**Validates: Requirements 4.7, 4.8**

### Property 13: Optimistic UI updates

*For any* notification action performed, the UI should update immediately without waiting for server responses.

**Validates: Requirements 4.9**


### Property 14: Sound preference changes take immediate effect

*For any* change to enable_sound or sound_volume preferences, all subsequent sound playback should immediately reflect the new settings without requiring page reload.

**Validates: Requirements 5.1, 5.2**

### Property 15: Notification sound type preference

*For any* change to notification_sound_type preference, the next notification arrival should play the newly selected sound type.

**Validates: Requirements 5.3**

### Property 16: Popup alerts when enabled

*For any* new notification arrival, if enable_popup_alerts is true, a toast notification should be displayed with the notification content.

**Validates: Requirements 6.3**

### Property 17: Toast action button for actionable notifications

*For any* notification with a non-null action_url, the toast notification should include a "View" action button that navigates to the action_url when clicked.

**Validates: Requirements 6.4, 6.5**


## Error Handling

### Designation Dropdown Errors

**Scenario:** custom_roles query fails
- **Handling:** Display empty dropdown with error message
- **User Feedback:** Toast notification: "Failed to load designations"
- **Recovery:** Retry button or page refresh

**Scenario:** No custom_roles exist in database
- **Handling:** Display placeholder text "No designations available"
- **User Feedback:** Inform admin/HR to create roles
- **Recovery:** Disable dropdown, show help text

### Sound System Errors

**Scenario:** Audio playback blocked by browser
- **Handling:** Silently fail (catch and ignore)
- **User Feedback:** None (autoplay restrictions are expected)
- **Recovery:** User can manually test sound in preferences

**Scenario:** Invalid sound type requested
- **Handling:** Fall back to default 'notification' sound
- **User Feedback:** Console warning (dev mode only)
- **Recovery:** Automatic fallback

**Scenario:** Sound_Manager not initialized
- **Handling:** Initialize singleton on first use
- **User Feedback:** None
- **Recovery:** Automatic initialization

### LocalStorage Errors

**Scenario:** localStorage quota exceeded
- **Handling:** Clear old notification state data
- **User Feedback:** Toast: "Notification history cleared to free space"
- **Recovery:** Automatic cleanup of oldest entries

**Scenario:** localStorage disabled/unavailable
- **Handling:** Fall back to in-memory state (session-only)
- **User Feedback:** Warning banner: "Notification preferences won't persist"
- **Recovery:** Continue with reduced functionality

### Real-time Subscription Errors

**Scenario:** Supabase connection lost
- **Handling:** Automatic reconnection via Supabase client
- **User Feedback:** Status indicator in notification panel
- **Recovery:** Automatic retry with exponential backoff

**Scenario:** Notification insert fails to trigger subscription
- **Handling:** Manual refresh button available
- **User Feedback:** Stale data indicator
- **Recovery:** User-initiated refresh


## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Together: Comprehensive coverage (unit tests catch concrete bugs, property tests verify general correctness)

### Unit Testing

**Focus Areas:**
1. Specific examples demonstrating correct behavior
2. Integration points between components
3. Edge cases and error conditions

**Example Unit Tests:**

```typescript
describe('useDesignations Hook', () => {
  it('should query custom_roles table', async () => {
    const { result } = renderHook(() => useDesignations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    // Verify the query targeted custom_roles
    expect(mockSupabase.from).toHaveBeenCalledWith('custom_roles');
  });

  it('should display empty state when no roles exist', async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      })
    });
    
    render(<ProfileSettings />);
    expect(screen.getByText('No designations available')).toBeInTheDocument();
  });
});

describe('Sound_Manager', () => {
  it('should not play sound when disabled', () => {
    const manager = SoundManager.getInstance();
    manager.setEnabled(false);
    
    const playSpy = jest.spyOn(HTMLAudioElement.prototype, 'play');
    manager.play('notification');
    
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('should apply volume from config', () => {
    const manager = SoundManager.getInstance();
    manager.setEnabled(true);
    
    manager.play('notification', { volume: 0.7 });
    
    // Verify audio element volume was set
    expect(mockAudio.volume).toBe(0.7);
  });
});

describe('Archive Button', () => {
  it('should display archive button on hover', () => {
    render(<NotificationItem notification={mockNotification} />);
    
    const item = screen.getByTestId('notification-item');
    fireEvent.mouseEnter(item);
    
    expect(screen.getByTitle('Archive')).toBeInTheDocument();
  });

  it('should use amber styling for archive button', () => {
    render(<NotificationItem notification={mockNotification} />);
    
    const archiveBtn = screen.getByTitle('Archive');
    expect(archiveBtn).toHaveClass('bg-amber-500/10', 'text-amber-500');
  });
});
```


### Property-Based Testing

**Configuration:**
- Minimum 100 iterations per property test
- Use fast-check library for TypeScript/JavaScript
- Tag each test with feature name and property number

**Property Test Examples:**

```typescript
import fc from 'fast-check';

describe('Property Tests: Designation Dropdown', () => {
  /**
   * Feature: notification-system-fixes, Property 1
   * For any Profile Settings page load, the designation dropdown should 
   * fetch and display only records from the custom_roles table
   */
  it('should always query custom_roles table', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          id: fc.uuid(),
          display_name: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          main_role: fc.constantFrom('admin', 'manager', 'employee')
        })),
        async (mockRoles) => {
          mockSupabase.from.mockReturnValue({
            select: () => ({
              order: () => Promise.resolve({ data: mockRoles, error: null })
            })
          });
          
          const { result } = renderHook(() => useDesignations());
          await waitFor(() => expect(result.current.isSuccess).toBe(true));
          
          expect(mockSupabase.from).toHaveBeenCalledWith('custom_roles');
          expect(result.current.data).toEqual(mockRoles);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notification-system-fixes, Property 2
   * For any custom_role selected, the stored designation_id should 
   * equal the custom_roles.id
   */
  it('should store custom_roles.id as designation_id', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          display_name: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 })
        }),
        async (selectedRole) => {
          render(<ProfileSettings />);
          
          const dropdown = screen.getByRole('combobox');
          await userEvent.click(dropdown);
          await userEvent.click(screen.getByText(selectedRole.display_name));
          
          await userEvent.click(screen.getByText('Save Changes'));
          
          await waitFor(() => {
            expect(mockUpdateProfile).toHaveBeenCalledWith(
              expect.objectContaining({
                designation_id: selectedRole.id
              })
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


```typescript
describe('Property Tests: Sound System', () => {
  /**
   * Feature: notification-system-fixes, Property 4
   * For any sound playback attempt, if enable_sound is false, 
   * the Sound_Manager should silently ignore the call
   */
  it('should not play sound when disabled', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('notification', 'success', 'error', 'warning', 'click'),
        fc.record({
          volume: fc.double({ min: 0, max: 1 }),
          playbackRate: fc.option(fc.double({ min: 0.5, max: 2 }))
        }),
        (soundType, config) => {
          const manager = SoundManager.getInstance();
          manager.setEnabled(false);
          
          const playSpy = jest.spyOn(HTMLAudioElement.prototype, 'play');
          manager.play(soundType as SoundType, config);
          
          expect(playSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notification-system-fixes, Property 5
   * For any sound played, the volume should match the preference
   */
  it('should apply volume from config', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('notification', 'success', 'error'),
        fc.double({ min: 0, max: 1 }),
        (soundType, volume) => {
          const manager = SoundManager.getInstance();
          manager.setEnabled(true);
          
          manager.play(soundType as SoundType, { volume });
          
          const audio = manager['audioCache'].get(soundType as SoundType);
          expect(audio?.volume).toBe(volume);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property Tests: Notification Management', () => {
  /**
   * Feature: notification-system-fixes, Property 11
   * For any authenticated user, all notification actions should work
   */
  it('should allow all users to manage notifications', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          role: fc.constantFrom('admin', 'manager', 'employee'),
          notificationId: fc.uuid()
        }),
        async ({ userId, role, notificationId }) => {
          mockAuth.user = { id: userId, role };
          
          const { result } = renderHook(() => useNotifications());
          
          // Test mark as read
          act(() => {
            result.current.handleMarkAsRead(notificationId);
          });
          expect(result.current.readItems.has(notificationId)).toBe(true);
          
          // Test delete
          act(() => {
            result.current.handleDelete(notificationId);
          });
          expect(result.current.deletedItems.has(notificationId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notification-system-fixes, Property 12
   * For any notification state change, localStorage should persist it
   */
  it('should persist notification state to localStorage', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (notificationIds) => {
          const { result } = renderHook(() => useNotifications());
          
          // Mark all as read
          act(() => {
            result.current.handleMarkAllAsRead(notificationIds);
          });
          
          // Verify localStorage
          const stored = JSON.parse(
            localStorage.getItem('lazeez-read-notifications') || '[]'
          );
          notificationIds.forEach(id => {
            expect(stored).toContain(id);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


### Edge Case Testing

**Edge cases identified in prework:**

1. **Empty custom_roles table** (Requirement 1.4)
   - Test: Load Profile Settings with no roles in database
   - Expected: Dropdown shows "No designations available"
   - Verify: Dropdown is disabled, no errors thrown

2. **Multiple simultaneous notifications** (Requirement 6.7)
   - Test: Insert 5+ notifications within 100ms window
   - Expected: Sound plays only once (debounced)
   - Verify: Audio.play() called exactly once

3. **localStorage quota exceeded**
   - Test: Fill localStorage to capacity, then archive notification
   - Expected: Automatic cleanup of oldest entries
   - Verify: New entry stored successfully, toast shown

4. **Browser autoplay restrictions**
   - Test: Attempt sound playback in restricted context
   - Expected: Silent failure, no errors
   - Verify: No console errors, app continues functioning

### Integration Testing

**Critical Integration Points:**

1. **Profile Settings ↔ custom_roles table**
   - Test full flow: Load page → Select role → Save → Verify database
   - Verify: designation_id correctly references custom_roles.id

2. **Notifications ↔ Sound_Manager ↔ UI Preferences**
   - Test: Change sound preference → Trigger notification → Verify sound
   - Verify: Preference changes immediately affect playback

3. **Real-time subscription ↔ Sound playback ↔ Toast notifications**
   - Test: Insert notification → Verify sound + toast appear
   - Verify: Both sound and visual feedback work together

4. **Archive button ↔ localStorage ↔ UI filtering**
   - Test: Archive notification → Verify localStorage → Reload page
   - Verify: Archived notification stays hidden after reload


## Implementation Notes

### Migration Considerations

#### Database Migration
No database migration required. The `custom_roles` table already exists from the RBAC system migration (20260323_final_master_migration.sql). The `profiles.designation_id` field already references `custom_roles(id)`.

#### Data Migration
If users have existing `designation_id` values pointing to the legacy `designations` table:

1. **Option A: Leave as-is** (Recommended)
   - Old designation_id values will simply not match any custom_roles
   - Users will see empty dropdown selection
   - They can re-select from custom_roles

2. **Option B: Migrate data**
   - Create mapping between old designations and new custom_roles
   - Run UPDATE query to map old IDs to new IDs
   - More complex, requires careful mapping

**Recommendation:** Option A is safer and simpler. The legacy `designations` table is being phased out, and users can easily re-select their designation.

### Backward Compatibility

#### Type Definitions
Update TypeScript interfaces to reflect custom_roles structure:

```typescript
// OLD
interface Designation {
  id: string;
  name: string;
}

// NEW
interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  main_role: 'admin' | 'manager' | 'employee';
  department_id?: string | null;
  permissions?: Record<string, boolean>;
}
```

#### Query Key Changes
Update TanStack Query cache keys to avoid stale data:

```typescript
// OLD: queryKey: ["designations"]
// NEW: queryKey: ["custom-roles"]
```

This ensures the cache is invalidated and fresh data is fetched.


### Sound System Integration Details

#### Singleton Pattern
The Sound_Manager uses the singleton pattern to ensure:
- Single audio cache across the application
- Consistent volume/enabled state
- No duplicate audio element creation

#### Audio Caching Strategy
```typescript
// First call: Creates and caches audio element
playSound('notification');  // Creates HTMLAudioElement

// Subsequent calls: Reuses cached element
playSound('notification');  // Reuses existing element
```

Benefits:
- Faster playback (no re-parsing of data URI)
- Lower memory usage
- Consistent audio behavior

#### Volume Application
Volume is applied at playback time, not at cache time:

```typescript
play(soundType: SoundType, config?: Partial<SoundConfig>) {
  const audio = this.getAudio(soundType);
  audio.volume = config?.volume ?? DEFAULT_CONFIGS[soundType].volume;
  audio.play();
}
```

This allows dynamic volume changes without recreating audio elements.

### LocalStorage Strategy

#### Key Naming Convention
```
lazeez-read-notifications       // Read state
lazeez-deleted-notifications    // Deleted/archived state
lazeez-notification-ui-preferences  // UI preferences
```

#### Data Structure
Store as JSON arrays for efficient Set operations:

```typescript
// Store
const items = [...itemSet];
localStorage.setItem(key, JSON.stringify(items));

// Retrieve
const items = JSON.parse(localStorage.getItem(key) || '[]');
const itemSet = new Set(items);
```

#### Cleanup Strategy
Implement automatic cleanup when localStorage approaches quota:

```typescript
const MAX_STORED_NOTIFICATIONS = 1000;

if (deletedItems.size > MAX_STORED_NOTIFICATIONS) {
  // Keep only most recent 500
  const sorted = [...deletedItems].slice(-500);
  localStorage.setItem(key, JSON.stringify(sorted));
}
```


### UI/UX Considerations

#### Archive Button Design

Following the design system guidelines:

**Visual Hierarchy:**
- Archive button: Amber color (`bg-amber-500/10 text-amber-500`)
- Delete button: Rose color (`bg-rose-500/10 text-rose-500`)
- Mark read button: Primary color (`bg-primary/10 text-primary`)

**Animation:**
```tsx
<motion.button
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  transition={{ duration: 0.15 }}
>
  <Archive className="w-3.5 h-3.5" />
</motion.button>
```

**Accessibility:**
- `title` attribute for tooltip
- `aria-label` for screen readers
- Keyboard accessible (Tab + Enter)
- Visible focus indicator

#### Toast Notifications

**Archive Confirmation:**
```typescript
toast.success("Notification archived", {
  icon: <Archive className="w-4 h-4" />,
  duration: 2000
});
```

**Notification Arrival (with action):**
```typescript
toast(notification.message, {
  description: notification.title,
  icon: <Bell className="w-4 h-4" />,
  action: notification.action_url ? {
    label: "View",
    onClick: () => navigate(notification.action_url)
  } : undefined,
  duration: 5000
});
```

#### Sound Feedback Mapping

| Action | Sound Type | Volume | Rationale |
|--------|-----------|--------|-----------|
| Notification arrives | User preference | 0.4 | Configurable by user |
| Mark as read | `success` | 0.3 | Positive action |
| Archive | `warning` | 0.3 | Neutral action |
| Delete | `error` | 0.3 | Destructive action |
| Bulk action complete | `success` | 0.3 | Batch completion |
| Refresh | `refresh` | 0.3 | System action |
| Click/navigate | `click` | 0.2 | Subtle feedback |


### Performance Optimizations

#### Debouncing Simultaneous Notifications

Prevent sound spam when multiple notifications arrive:

```typescript
let notificationSoundTimeout: NodeJS.Timeout | null = null;

const playNotificationSound = () => {
  if (notificationSoundTimeout) {
    clearTimeout(notificationSoundTimeout);
  }
  
  notificationSoundTimeout = setTimeout(() => {
    const preferences = getUIPreferences();
    if (preferences.enable_sound) {
      playSound(preferences.notification_sound_type as SoundType);
    }
    notificationSoundTimeout = null;
  }, 300); // 300ms debounce
};
```

#### Optimistic UI Updates

All notification actions update UI immediately:

```typescript
const handleMarkAsRead = (id: string) => {
  // 1. Update local state immediately
  setReadItems(prev => new Set([...prev, id]));
  
  // 2. Update localStorage (async but non-blocking)
  queueMicrotask(() => {
    const items = [...readItems, id];
    localStorage.setItem('lazeez-read-notifications', JSON.stringify(items));
  });
  
  // 3. No server call needed (client-side only)
};
```

#### Query Cache Invalidation

Only invalidate when necessary:

```typescript
// Real-time notification arrives
supabase.on('INSERT', (payload) => {
  // Invalidate to fetch new notification
  queryClient.invalidateQueries(['unified-notifications']);
  
  // Don't invalidate on client-side actions (mark read, delete)
  // Those are localStorage-only and don't need refetch
});
```

#### Audio Element Reuse

Cache audio elements to avoid re-parsing data URIs:

```typescript
class SoundManager {
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map();
  
  private getAudio(soundType: SoundType): HTMLAudioElement {
    if (!this.audioCache.has(soundType)) {
      const audio = new Audio(SOUND_DATA[soundType]);
      this.audioCache.set(soundType, audio);
    }
    return this.audioCache.get(soundType)!;
  }
}
```

This reduces memory allocations and improves playback latency.


## Security Considerations

### Client-Side State Management

**Threat Model:**
- Notification read/delete state is stored in localStorage
- This is client-side only and can be manipulated by users
- Users can only affect their own notification view, not others

**Mitigation:**
- This is acceptable because:
  1. Users can only manipulate their own view
  2. No server-side data is affected
  3. Notifications remain in database for audit purposes
  4. Other users' views are unaffected

**Not a Security Risk:**
- Users clearing localStorage just resets their view
- No privilege escalation possible
- No data leakage to other users

### Permission-Free Actions

**Design Decision:**
Notification management actions (mark read, delete, archive) do NOT require elevated permissions.

**Rationale:**
1. Users should control their own notification feed
2. Actions are view-only (localStorage filtering)
3. No database writes occur
4. No impact on other users
5. Improves UX (no permission errors)

**Contrast with Other Features:**
- Vendor management: Requires permissions (affects shared data)
- User management: Requires admin (affects other users)
- Notification management: No permissions (affects only self)

### Sound System Security

**XSS Prevention:**
- Sound data URIs are embedded in code (not user input)
- No dynamic audio source loading from user input
- No eval() or dynamic code execution

**Resource Exhaustion:**
- Audio elements are cached (limited memory usage)
- Debouncing prevents sound spam
- Silent failure on autoplay restrictions


## Deployment Considerations

### Rollout Strategy

**Phase 1: Designation Dropdown Fix**
- Low risk, isolated change
- Deploy first to validate custom_roles integration
- Monitor for query errors or empty dropdowns

**Phase 2: Sound System Integration**
- Medium risk, affects user experience
- Deploy with feature flag if possible
- Monitor for audio playback issues

**Phase 3: Archive Button**
- Low risk, additive feature
- Deploy alongside sound system
- Monitor for localStorage issues

**Phase 4: Permission Removal**
- Low risk, removes restrictions
- Deploy last to ensure other fixes work
- Monitor for unexpected behavior

### Rollback Plan

**If designation dropdown fails:**
- Revert useDesignations hook to query `designations` table
- Users can still select designations (legacy data)
- Fix and redeploy

**If sound system fails:**
- Sounds simply won't play (graceful degradation)
- No functional impact on notifications
- Fix and redeploy

**If archive button causes issues:**
- Button appears but may not work
- Users can still use bulk archive
- Fix and redeploy

**If permission removal causes issues:**
- Re-add permission checks
- Only affects non-admin users
- Fix and redeploy

### Monitoring

**Key Metrics:**
1. Designation dropdown load success rate
2. Sound playback success rate (if trackable)
3. Archive action success rate
4. localStorage quota errors
5. Real-time subscription connection rate

**Alerts:**
- Spike in designation query errors
- Increase in localStorage errors
- Drop in notification interaction rate


## Future Enhancements

### Potential Improvements

1. **Server-Side Notification State**
   - Store read/archived state in database
   - Sync across devices
   - Requires new `notification_state` table

2. **Advanced Sound Customization**
   - Upload custom notification sounds
   - Per-category sound selection
   - Sound themes (professional, playful, minimal)

3. **Notification Filtering**
   - Filter by category, priority, date range
   - Save filter presets
   - Smart filters (unread, urgent, today)

4. **Notification Scheduling**
   - Quiet hours (no sounds during specified times)
   - Do Not Disturb mode
   - Schedule-based sound profiles

5. **Archive Management**
   - View archived notifications
   - Restore from archive
   - Auto-archive after X days

6. **Notification Analytics**
   - Track notification engagement
   - Identify notification fatigue
   - Optimize notification timing

### Technical Debt

**Items to Address Later:**

1. **Legacy designations table**
   - Fully deprecate and remove
   - Migrate any remaining references
   - Clean up database schema

2. **Sound data URIs**
   - Consider moving to actual audio files
   - Implement lazy loading
   - Add more sound options

3. **localStorage limits**
   - Implement IndexedDB fallback
   - Add compression for stored data
   - Implement smarter cleanup strategies

4. **Type safety**
   - Strengthen TypeScript types for custom_roles
   - Add runtime validation for localStorage data
   - Improve sound type safety


## Acceptance Criteria Validation

### Requirement 1: Fix Designation Dropdown Data Source ✓

- [x] 1.1: Profile Settings fetches from custom_roles table
- [x] 1.2: Displays display_name field in dropdown
- [x] 1.3: Stores custom_roles.id as designation_id
- [x] 1.4: Shows "No designations available" when empty
- [x] 1.5: No hardcoded designation values
- [x] 1.6: Pre-selects matching designation_id
- [x] 1.7: useDesignations queries custom_roles table

**Design Coverage:** Components section details hook changes, ProfileSettings updates, and empty state handling.

### Requirement 2: Integrate Sound System for Notifications ✓

- [x] 2.1: New notifications play user's selected sound type
- [x] 2.2: Uses Sound_Manager.play() instead of local Audio()
- [x] 2.3: Action buttons play appropriate sounds
- [x] 2.4: Respects enable_sound preference
- [x] 2.5: Applies sound_volume preference
- [x] 2.6: No sounds when disabled (duplicate of 2.4)
- [x] 2.7: Plays notification_sound_type from preferences
- [x] 2.8: Refresh button plays refresh sound
- [x] 2.9: Bulk actions play corresponding sounds

**Design Coverage:** Sound System Integration section details all playSound calls, preference connections, and real-time integration.

### Requirement 3: Add Visible Archive Button ✓

- [x] 3.1: Archive button appears on hover
- [x] 3.2: Calls handleDelete with notification ID
- [x] 3.3: Shows "Notification archived" toast
- [x] 3.4: Uses Archive icon from lucide-react
- [x] 3.5: Amber color (distinct from rose delete button)
- [x] 3.6: Appears alongside mark as read button
- [x] 3.7: Removes notification from visible list immediately

**Design Coverage:** Notifications Component section shows complete archive button implementation with styling and behavior.

### Requirement 4: Fix Notification Actions for All Users ✓

- [x] 4.1: Any user can delete notifications
- [x] 4.2: Any user can mark as read
- [x] 4.3: Any user can bulk mark as read
- [x] 4.4: Any user can bulk delete
- [x] 4.5: Any user can bulk archive
- [x] 4.6: No admin/staff permission requirements
- [x] 4.7: Persists read state in localStorage
- [x] 4.8: Persists deleted state in localStorage
- [x] 4.9: Optimistic UI updates

**Design Coverage:** useNotifications Hook section removes permission checks and details localStorage persistence.

### Requirement 5: Connect Sound Preferences to Playback ✓

- [x] 5.1: enable_sound toggle immediately affects playback
- [x] 5.2: Volume slider applies to subsequent sounds
- [x] 5.3: notification_sound_type selection changes sound
- [x] 5.4: Test button plays selected sound at configured volume
- [x] 5.5: Calls setSoundEnabled() on preference change
- [x] 5.6: Reads notification_sound_type from UI_Preferences
- [x] 5.7: Silently ignores play() when disabled (duplicate of 2.4)

**Design Coverage:** NotificationSoundPreferences section details all preference connections and Sound_Manager integration.

### Requirement 6: Test Sound Effects on Notification Arrival ✓

- [x] 6.1: Real-time subscription detects new notifications
- [x] 6.2: Subscription trigger plays sound (duplicate of 2.1)
- [x] 6.3: Shows toast when enable_popup_alerts is true
- [x] 6.4: Toast includes "View" button if action_url exists
- [x] 6.5: "View" button navigates to action_url
- [x] 6.6: Invalidates query cache after real-time notification
- [x] 6.7: Debounces sound for simultaneous notifications

**Design Coverage:** Real-time notification section in Notifications Component and Performance Optimizations section detail debouncing.


## Summary

This design document provides a comprehensive solution for four critical notification system issues:

1. **Designation Dropdown Fix**: Migrates from legacy `designations` table to `custom_roles` table, ensuring proper integration with the two-layer RBAC system. The fix updates the `useDesignations` hook to query `custom_roles` and displays `display_name` values in the Profile Settings dropdown.

2. **Sound System Integration**: Replaces local audio instantiation with the existing `Sound_Manager` singleton, providing centralized sound management with proper volume control, enable/disable functionality, and preference integration. All notification actions now play appropriate sound effects.

3. **Archive Button Addition**: Adds a visible archive button to notification hover actions with amber styling (distinct from the rose delete button), providing users with intuitive access to archive functionality that was previously only available through bulk actions.

4. **Permission-Free Notification Management**: Removes unnecessary permission checks from notification actions, allowing all authenticated users to manage their own notifications. State is persisted in localStorage for client-side filtering, with no server-side writes required.

### Key Design Decisions

- **No Database Migration Required**: The `custom_roles` table already exists; only application code changes needed
- **Client-Side State Management**: Read/delete state stored in localStorage for performance and simplicity
- **Singleton Sound Manager**: Centralized audio management with caching for optimal performance
- **Optimistic UI Updates**: All actions update UI immediately without waiting for server responses
- **Graceful Degradation**: Sound playback failures are silent; localStorage issues trigger automatic cleanup

### Implementation Complexity

- **Low Risk**: Designation dropdown (isolated query change)
- **Low Risk**: Archive button (additive UI feature)
- **Medium Risk**: Sound integration (affects user experience)
- **Low Risk**: Permission removal (removes restrictions)

### Testing Requirements

- 17 correctness properties for property-based testing (100+ iterations each)
- Unit tests for specific examples and edge cases
- Integration tests for critical component interactions
- Edge case testing for empty states, quota limits, and simultaneous events

The design ensures backward compatibility, maintains security, and follows the Lazeez VORP design system guidelines for animations, colors, and accessibility.

