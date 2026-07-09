# Implementation Plan: Notification System Fixes

## Overview

This implementation plan addresses four critical issues in the Lazeez VORP notification system: (1) fixing the designation dropdown to query custom_roles instead of the legacy designations table, (2) integrating the existing Sound_Manager singleton for notification sounds, (3) adding visible archive buttons to individual notifications, and (4) removing unnecessary permission checks to allow all users to manage their notifications.

The implementation follows a phased approach, starting with the lowest-risk changes (designation dropdown) and progressing to more complex integrations (sound system). Each phase includes testing tasks to validate correctness properties.

## Tasks

- [x] 1. Fix designation dropdown data source
  - [x] 1.1 Update useDesignations hook to query custom_roles table
    - Modify `src/components/hooks/useUsers.ts`
    - Change query from `designations` table to `custom_roles` table
    - Update query key from `["designations"]` to `["custom-roles"]`
    - Select fields: `id, name, display_name, description, main_role`
    - Order by `display_name` ascending
    - Update return type to `CustomRole[]`
    - _Requirements: 1.1, 1.7_
  
  - [x] 1.2 Update TypeScript interfaces for custom_roles
    - Add `CustomRole` interface in `src/components/hooks/useUsers.ts` or appropriate types file
    - Include fields: `id`, `name`, `display_name`, `description`, `main_role`, `department_id`, `permissions`
    - Ensure `main_role` type is `'admin' | 'manager' | 'employee'`
    - _Requirements: 1.2_
  
  - [x] 1.3 Update ProfileSettings component to use display_name
    - Modify `src/components/settings/ProfileSettings.tsx`
    - Change dropdown rendering to display `role.display_name` instead of `role.name`
    - Ensure value binding uses `role.id` (should already be correct)
    - Add empty state handling: show "No designations available" when array is empty
    - Disable dropdown when no designations exist
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 1.4 Write property test for designation dropdown data source
    - **Property 1: Designation dropdown displays custom_roles data**
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.7**
    - Test that useDesignations always queries custom_roles table
    - Generate random arrays of custom_roles records
    - Verify query targets correct table and returns correct data
    - Minimum 100 iterations

- [x] 2. Integrate Sound_Manager for notification sounds
  - [x] 2.1 Remove local playSound function from Notifications component
    - Open `src/components/pages/Notifications.tsx`
    - Remove the local `playSound` function (lines ~87-93)
    - Add import: `import { playSound } from "@/components/utils/soundEffects";`
    - _Requirements: 2.2_
  
  - [x] 2.2 Update all sound playback calls to use correct sound types
    - Replace `playSound("pop")` with `playSound("click")`
    - Replace `playSound("delete")` with `playSound("error")`
    - Replace `playSound("archive")` with `playSound("warning")`
    - Keep `playSound("success")`, `playSound("click")`, `playSound("refresh")` as-is
    - _Requirements: 2.3, 2.8, 2.9_
  
  - [x] 2.3 Add sound playback to real-time notification subscription
    - Locate real-time subscription in Notifications component or useNotifications hook
    - In the INSERT event handler, add sound playback logic
    - Read UI preferences: `const preferences = getUIPreferences();`
    - Check `preferences.enable_sound` before playing
    - Play sound: `playSound(preferences.notification_sound_type as SoundType, { volume: preferences.sound_volume })`
    - _Requirements: 2.1, 2.4, 2.5, 2.7, 6.1, 6.2_
  
  - [x] 2.4 Add popup toast for real-time notifications
    - In the same INSERT event handler, check `preferences.enable_popup_alerts`
    - If enabled, display toast with notification content
    - Include "View" action button if `notification.action_url` exists
    - Navigate to `action_url` when "View" is clicked
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [x] 2.5 Implement debouncing for simultaneous notifications
    - Create debounce logic to prevent sound spam
    - Use 300ms timeout to group simultaneous notifications
    - Ensure sound plays only once when multiple notifications arrive
    - _Requirements: 6.7_
  
  - [ ]* 2.6 Write property test for Sound_Manager respects enable_sound
    - **Property 4: Sound_Manager respects enable_sound preference**
    - **Validates: Requirements 2.4, 2.6, 5.7**
    - Test that when enable_sound is false, no audio plays
    - Generate random sound types and configs
    - Verify HTMLAudioElement.play() is never called when disabled
    - Minimum 100 iterations

- [x] 3. Checkpoint - Verify sound integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add visible archive button to notifications
  - [x] 4.1 Add archive button to notification hover actions
    - Open `src/components/pages/Notifications.tsx`
    - Locate the hover actions section (around line 700+)
    - Add Archive icon import: `import { Archive } from "lucide-react";`
    - Add archive button with amber styling: `bg-amber-500/10 hover:bg-amber-500/20 text-amber-500`
    - Use Framer Motion: `whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}`
    - On click: call `handleDelete(notification.id)`, play warning sound, show toast
    - Position between mark-as-read button and delete button
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_
  
  - [x] 4.2 Add toast confirmation for archive action
    - In archive button onClick handler, add: `toast.success("Notification archived")`
    - Include Archive icon in toast
    - Set duration to 2000ms
    - _Requirements: 3.3_
  
  - [x] 4.3 Verify archive removes notification from visible list
    - Test that `handleDelete` adds notification ID to `deletedItems` Set
    - Verify notification is filtered from visible list immediately
    - Ensure localStorage is updated with deleted notification ID
    - _Requirements: 3.7_
  
  - [ ]* 4.4 Write property test for archive action
    - **Property 9: Archive action removes notification**
    - **Validates: Requirements 3.2, 3.7**
    - Test that archived notifications are added to deletedItems and removed from view
    - Generate random notification IDs
    - Verify localStorage persistence and UI filtering
    - Minimum 100 iterations

- [x] 5. Remove permission checks from notification actions
  - [x] 5.1 Update useNotifications hook to remove permission checks
    - Open `src/hooks/useNotifications.ts` or locate hook in Notifications component
    - Remove any `if (!isAdmin && !isStaff)` checks from notification actions
    - Ensure `handleMarkAsRead`, `handleDelete`, `handleMarkAllAsRead` work for all users
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 5.2 Ensure localStorage persistence for all notification actions
    - Verify `handleMarkAsRead` stores in `lazeez-read-notifications` localStorage key
    - Verify `handleDelete` stores in `lazeez-deleted-notifications` localStorage key
    - Verify bulk operations update localStorage correctly
    - Ensure Set-to-Array conversion: `JSON.stringify([...itemSet])`
    - _Requirements: 4.7, 4.8_
  
  - [x] 5.3 Implement optimistic UI updates for all actions
    - Ensure all state updates happen immediately (no async waits)
    - Update local state first, then localStorage asynchronously
    - Use `queueMicrotask` or similar for non-blocking localStorage writes
    - _Requirements: 4.9_
  
  - [ ]* 5.4 Write property test for permission-free notification management
    - **Property 11: All users can manage notifications**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**
    - Test that users with any role (admin, manager, employee) can perform all actions
    - Generate random user roles and notification IDs
    - Verify mark read, delete, and bulk operations work for all roles
    - Minimum 100 iterations

- [x] 6. Connect sound preferences to playback
  - [x] 6.1 Update NotificationSoundPreferences to call setSoundEnabled
    - Open `src/components/settings/NotificationSoundPreferences.tsx`
    - Add import: `import { setSoundEnabled } from "@/components/utils/soundEffects";`
    - Create `handleSoundToggle` function that calls both `updatePreferences` and `setSoundEnabled`
    - Connect to Switch component's `onCheckedChange` prop
    - _Requirements: 5.1, 5.5_
  
  - [x] 6.2 Ensure volume preference is applied to all sound playback
    - Verify all `playSound()` calls read volume from UI preferences
    - Pass volume in config: `playSound(type, { volume: preferences.sound_volume })`
    - Update any hardcoded volume values to use preferences
    - _Requirements: 2.5, 5.2_
  
  - [x] 6.3 Implement Test button in NotificationSoundPreferences
    - Add Test button to sound preferences UI
    - On click: read preferences and play selected sound type at configured volume
    - Use: `playSound(preferences.notification_sound_type as SoundType, { volume: preferences.sound_volume })`
    - _Requirements: 5.4_
  
  - [x] 6.4 Verify notification_sound_type preference is used for arrivals
    - Ensure real-time notification handler reads `notification_sound_type` from preferences
    - Verify sound type changes immediately affect next notification
    - _Requirements: 5.3, 5.6_
  
  - [ ]* 6.5 Write property test for sound preference changes
    - **Property 14: Sound preference changes take immediate effect**
    - **Validates: Requirements 5.1, 5.2**
    - Test that enable_sound and volume changes immediately affect playback
    - Generate random preference values
    - Verify subsequent sounds respect new settings without page reload
    - Minimum 100 iterations

- [x] 7. Create UI preferences helper utility
  - [x] 7.1 Create getUIPreferences utility function
    - Create file: `src/components/utils/notificationPreferences.ts` or add to existing file
    - Implement `getUIPreferences()` function that reads from localStorage
    - Return default values if localStorage key doesn't exist
    - Define `UIPreferences` interface with all preference fields
    - Export both interface and function
    - _Requirements: 2.4, 2.5, 5.6, 6.3_

- [x] 8. Final checkpoint - Integration testing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration and verification
  - [x] 9.1 Test designation dropdown with custom_roles data
    - Load Profile Settings page
    - Verify dropdown shows custom_roles display_name values
    - Select a designation and save
    - Verify profiles.designation_id is set to custom_roles.id
    - Test empty state when no custom_roles exist
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  
  - [x] 9.2 Test sound playback for all notification events
    - Trigger notification arrival (insert test notification)
    - Verify sound plays at correct volume
    - Click mark as read, archive, delete buttons
    - Verify each plays appropriate sound effect
    - Test with sound disabled - verify no audio plays
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.7_
  
  - [x] 9.3 Test archive button visibility and functionality
    - Hover over notification item
    - Verify archive button appears with amber styling
    - Click archive button
    - Verify notification disappears and toast shows "Notification archived"
    - Reload page and verify notification stays archived
    - _Requirements: 3.1, 3.2, 3.3, 3.7_
  
  - [x] 9.4 Test notification actions for non-admin users
    - Log in as employee or manager (non-admin)
    - Mark notification as read - verify it works
    - Delete notification - verify it works
    - Archive notification - verify it works
    - Perform bulk operations - verify they work
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 9.5 Test sound preference changes
    - Open notification sound preferences
    - Toggle enable_sound off - verify sounds stop
    - Toggle enable_sound on - verify sounds resume
    - Adjust volume slider - verify volume changes
    - Change notification_sound_type - verify new sound plays
    - Click Test button - verify selected sound plays
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 9.6 Test real-time notification with sound and popup
    - Insert test notification into database for current user
    - Verify sound plays (if enabled)
    - Verify toast popup appears (if enabled)
    - Verify "View" button appears if action_url exists
    - Click "View" button - verify navigation works
    - Test with multiple simultaneous notifications - verify sound plays once
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

- [x] 10. Final checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (100+ iterations each)
- Integration tests in task 9 verify end-to-end functionality
- No database migrations required - custom_roles table already exists
- All notification state management is client-side (localStorage only)
- Sound system uses existing Sound_Manager singleton (no new infrastructure needed)
