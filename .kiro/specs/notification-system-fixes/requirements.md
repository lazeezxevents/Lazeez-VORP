# Requirements Document

## Introduction

This specification addresses critical bugs and missing functionality in the Lazeez VORP notification system and user settings. The system currently has four main issues: (1) the designation dropdown in profile settings shows hardcoded values instead of database-stored custom roles, (2) notification sound effects are not playing despite having a sound system implemented, (3) archive functionality exists in the backend but lacks visible UI controls, and (4) notification actions (delete, mark as read) have permission or state management issues preventing them from working for all users.

These fixes are essential for proper user experience, as notifications are a core communication mechanism in the ERP system, and profile settings must accurately reflect the organization's role structure.

## Glossary

- **Notification_System**: The unified notification management system that aggregates notifications from multiple sources (MOUs, issues, projects, HR, audit logs)
- **Sound_Manager**: The singleton class responsible for playing audio feedback for user interactions and system events
- **Profile_Settings**: The user interface component where users manage their personal information including designation
- **Custom_Roles**: Database table storing role-based designations with permissions (Layer 2 of the two-layer role system)
- **Designations**: Legacy table for simple designation names (being phased out in favor of custom_roles)
- **Archive_Action**: The operation to move notifications to archived state, removing them from active view while preserving them for history
- **Notification_Preferences**: User-configurable settings for notification behavior including sound, volume, and alert types
- **UI_Preferences**: Local storage-based preferences for notification interface behavior

## Requirements

### Requirement 1: Fix Designation Dropdown Data Source

**User Story:** As a user, I want to see only my organization's actual role-based designations in the profile settings dropdown, so that I can accurately represent my position in the system.

#### Acceptance Criteria

1. WHEN the Profile Settings page loads, THE Profile_Settings SHALL fetch designations from the custom_roles table
2. THE Profile_Settings SHALL display the display_name field from custom_roles in the dropdown options
3. THE Profile_Settings SHALL store the custom_roles.id as the designation_id when a user selects a designation
4. WHEN no custom roles exist in the database, THE Profile_Settings SHALL display an empty dropdown with placeholder text "No designations available"
5. THE Profile_Settings SHALL NOT display any hardcoded designation values (such as "CTO" or "COO")
6. WHEN a user's current designation_id matches a custom_role, THE Profile_Settings SHALL pre-select that option in the dropdown
7. THE useDesignations hook SHALL query the custom_roles table instead of the designations table

### Requirement 2: Integrate Sound System for Notifications

**User Story:** As a user, I want to hear audio feedback when notifications arrive and when I interact with them, so that I have clear confirmation of system events and my actions.

#### Acceptance Criteria

1. WHEN a new notification arrives via real-time subscription, THE Notification_System SHALL play the user's selected notification sound type
2. THE Notification_System SHALL use the Sound_Manager.play() method instead of local Audio() instantiation
3. WHEN a user clicks a notification action button, THE Notification_System SHALL play the appropriate sound (success, click, archive, delete)
4. THE Sound_Manager SHALL respect the user's enable_sound preference from UI_Preferences
5. THE Sound_Manager SHALL apply the user's sound_volume preference to all played sounds
6. WHEN notification sounds are disabled in preferences, THE Sound_Manager SHALL NOT play any notification sounds
7. THE Notification_System SHALL play the notification_sound_type selected in NotificationSoundPreferences (notification, bell_ring, or success)
8. WHEN the manual refresh button is clicked, THE Notification_System SHALL play the refresh sound
9. WHEN bulk actions complete (mark read, archive, delete), THE Notification_System SHALL play the corresponding sound effect

### Requirement 3: Add Visible Archive Button for Individual Notifications

**User Story:** As a user, I want to see an archive button on each notification, so that I can quickly archive individual notifications without using bulk actions or category menus.

#### Acceptance Criteria

1. WHEN a user hovers over a notification item, THE Notification_System SHALL display an archive button in the hover action area
2. WHEN a user clicks the archive button on a notification, THE Notification_System SHALL call handleDelete with that notification's ID
3. THE Notification_System SHALL display a toast confirmation message "Notification archived" after archiving
4. THE archive button SHALL use the Archive icon from lucide-react
5. THE archive button SHALL be visually distinct from the delete button (different color: amber vs rose)
6. THE archive button SHALL appear alongside existing hover actions (mark as read button)
7. WHEN a notification is archived, THE Notification_System SHALL remove it from the visible notification list immediately

### Requirement 4: Fix Notification Actions for All Users

**User Story:** As any user (not just admins), I want to be able to delete, mark as read, and perform bulk operations on my notifications, so that I can manage my notification feed effectively.

#### Acceptance Criteria

1. WHEN any authenticated user clicks the delete button on a notification, THE Notification_System SHALL delete that notification from their view
2. WHEN any authenticated user clicks mark as read on a notification, THE Notification_System SHALL mark that notification as read
3. WHEN any authenticated user selects multiple notifications and clicks bulk mark as read, THE Notification_System SHALL mark all selected notifications as read
4. WHEN any authenticated user selects multiple notifications and clicks bulk delete, THE Notification_System SHALL delete all selected notifications
5. WHEN any authenticated user selects multiple notifications and clicks bulk archive, THE Notification_System SHALL archive all selected notifications
6. THE Notification_System SHALL NOT require admin or staff permissions for notification management actions
7. THE Notification_System SHALL persist read/unread state in localStorage using the readItems Set
8. THE Notification_System SHALL persist deleted state in localStorage using the deletedItems Set
9. WHEN a user performs any notification action, THE Notification_System SHALL update the UI optimistically without waiting for server response

### Requirement 5: Connect Sound Preferences to Playback

**User Story:** As a user, I want my notification sound preferences to actually control what sounds play, so that I can customize my audio experience.

#### Acceptance Criteria

1. WHEN a user changes the enable_sound toggle in NotificationSoundPreferences, THE Sound_Manager SHALL immediately enable or disable all sounds
2. WHEN a user adjusts the volume slider in NotificationSoundPreferences, THE Sound_Manager SHALL apply that volume to all subsequent sound playback
3. WHEN a user selects a different notification_sound_type, THE Notification_System SHALL use that sound type for new notification alerts
4. WHEN a user clicks the "Test" button in NotificationSoundPreferences, THE Sound_Manager SHALL play the selected sound at the configured volume
5. THE NotificationSoundPreferences component SHALL call setSoundEnabled() when the enable_sound preference changes
6. THE Notification_System SHALL read notification_sound_type from UI_Preferences when playing notification arrival sounds
7. WHEN enable_sound is false, THE Sound_Manager SHALL silently ignore all play() calls without throwing errors

### Requirement 6: Test Sound Effects on Notification Arrival

**User Story:** As a developer, I want to verify that sounds play correctly when notifications arrive, so that users receive proper audio feedback for system events.

#### Acceptance Criteria

1. WHEN a new notification is inserted into the notifications table for the current user, THE Notification_System SHALL detect it via real-time subscription
2. WHEN the real-time subscription triggers, THE Notification_System SHALL play the configured notification sound
3. WHEN enable_popup_alerts is true in UI_Preferences, THE Notification_System SHALL display a toast notification with the notification content
4. THE toast notification SHALL include a "View" action button if the notification has an action_url
5. WHEN the user clicks the "View" button in the toast, THE Notification_System SHALL navigate to the action_url
6. THE Notification_System SHALL invalidate the unified-notifications query cache after receiving a real-time notification
7. WHEN multiple notifications arrive simultaneously, THE Sound_Manager SHALL play the notification sound only once (debounced)

## Special Requirements Guidance

### Sound System Integration
The existing `soundEffects.ts` file provides a complete sound management system with embedded audio data URIs. The integration requires:
- Replacing local `playSound()` function in Notifications.tsx with imports from soundEffects.ts
- Using `playSound(soundType, config)` instead of `new Audio()`
- Connecting UI preferences to `setSoundEnabled()` and volume configuration
- Ensuring sound playback respects user preferences at all times

### Designation Dropdown Migration
The system is transitioning from the simple `designations` table to the more robust `custom_roles` table. The fix requires:
- Updating `useDesignations()` hook to query `custom_roles` instead of `designations`
- Mapping `custom_roles.display_name` for display and `custom_roles.id` for storage
- Ensuring backward compatibility if some users still have designation_id pointing to old designations table
- Maintaining the permission check that only admins/HR can edit department/designation

### Archive vs Delete Semantics
The current implementation treats "delete" as "archive" (stores in localStorage, doesn't actually delete from database). The requirements maintain this behavior:
- Archive button calls `handleDelete()` which adds to deletedItems Set
- Deleted items are filtered from view but preserved in localStorage
- True database deletion is not implemented (notifications are client-side filtered only)
- Archive functionality stores notifications in "lazeez-archived-notifications" localStorage key

### Permission-Free Notification Management
Unlike other system features, notification management should not require elevated permissions:
- All users can manage their own notifications regardless of role
- Read/unread state is per-user and stored in localStorage
- Delete/archive state is per-user and stored in localStorage
- No database writes are required for these actions (client-side only)
