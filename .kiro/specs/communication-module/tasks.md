# Implementation Plan: Communication Module

## Overview

This implementation plan breaks down the Communication Module into actionable tasks aligned with the 5-day sprint timeline (May 5-9, 2026). The module provides Slack-like real-time communication with instant messaging, voice/video calling, threaded conversations, and deep integration with VORP systems.

**Technology Stack**: React 18.3.1 + TypeScript, Supabase (PostgreSQL + Edge Functions), WebSocket + Redis Pub/Sub, WebRTC (simple-peer), shadcn/ui, TanStack Query, Framer Motion

**Sprint Timeline**:
- **Day 1 (May 5)**: Architecture & Core Setup
- **Day 2 (May 6)**: Feature Build & ERP Integration
- **Day 3 (May 7)**: Security, Performance & Dev Handoff
- **Day 4 (May 8)**: Testing & QA/QC
- **Day 5 (May 9)**: Debug, UAT & Sprint Close

## Production program status (read before marking tasks complete)

**Shipped core (tasks 1–17 in this plan):** database/RLS for communication, Supabase Realtime channel messaging, DMs, composer with sanitization and channel attachments, security utilities, presence, search UI and client-side search patterns, performance-oriented hooks/tests, and related UI. The **Vite production build** (`npm run build`) is the primary release gate for the SPA.

**Not the same as “every checkbox below is done”:** Tasks **13** (production WebRTC: TURN, consent, signaling SLA), **18–34** (extended channel admin, bookmarks, polls, slash commands, calendar-linked calls, recording, mobile hardening, offline parity), and **35–41** (full automated QA matrix, observability, legal/compliance exports, documentation) are **multi-sprint** programs. Completing them requires **operational infrastructure** (WebSocket service + Redis, STUN/TURN, retention policies, security review), not only React code.

**DevOps / engineering guardrails:**
1. After migration changes, regenerate typings (`supabase gen types`) and merge into `src/components/integrations/supabase/types.ts`.
2. Run before release: `npm run build`, `npm run test`, `npm run lint`, and `npm run typecheck` (typecheck uses `tsconfig.app.json`; test files are excluded there—run Vitest for component tests).
3. Deploy `websocket-server` with validated JWTs and Redis when using WebSocket features; set `VITE_WS_URL` to `wss://` in production.
4. Treat **defense in depth**: keep message rendering on sanitized paths (e.g. `MessageContent` / `sanitizeMarkdown`); run dependency audit (`npm audit`) in CI.

**Application fixes aligned with this plan (ongoing):** Communication layout for DMs (full-width split), `MessageComposer` on channels with Supabase attachment pipeline, removal of non-functional call buttons in DM chrome, and sanitized rich message body rendering in `ChannelView`.

---

## Tasks

### Phase 1: Architecture & Core Setup (Day 1 - May 5)

- [x] 1. Database schema and migrations
  - [x] 1.1 Create database migration file for communication module
    - Create `supabase/migrations/YYYYMMDDHHMMSS_communication_module.sql`
    - Define all tables: departments, channels, channel_members, messages, message_attachments, message_reactions, direct_messages, dm_messages, user_presence, message_bookmarks, message_reminders, pinned_messages, call_sessions, call_participants, message_polls
    - Add indexes on frequently queried columns (channel_id, user_id, created_at, thread_parent_id)
    - Implement foreign key constraints for referential integrity
    - Add full-text search index on messages.search_vector using GIN
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8, 28.9, 28.10, 28.11_


  - [x] 1.2 Implement Row Level Security (RLS) policies
    - Create RLS policies for channels table (users can view channels they're members of)
    - Create RLS policies for messages table (users can view/send messages in their channels)
    - Create RLS policies for channel_members table (users can view members of their channels)
    - Create RLS policies for direct_messages and dm_messages tables
    - Create RLS policies for user_presence table (all authenticated users can view)
    - Test RLS policies with different user roles (Admin, Manager, Employee)
    - _Requirements: 28.12, 4.1, 4.3, 4.8_

  - [x] 1.3 Write property test for RLS policies
    - **Property 1: Channel access control**
    - **Validates: Requirements 4.3, 4.8**
    - Test that users can only access channels they are members of
    - Test that admins can access all channels
    - Test that private channel access requires explicit membership

- [x] 2. WebSocket server infrastructure
  - [x] 2.1 Set up WebSocket server with authentication
    - Create WebSocket server using Node.js (ws library)
    - Implement JWT token validation on connection
    - Set up connection heartbeat with 30-second ping intervals
    - Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s max)
    - _Requirements: 19.1, 19.3, 19.4, 19.5, 19.6_

  - [x] 2.2 Integrate Redis Pub/Sub for message distribution
    - Set up Redis client connection
    - Implement publish/subscribe pattern for message broadcasting
    - Create channel subscription management (subscribe on join, unsubscribe on leave)
    - Test message distribution across multiple server instances
    - _Requirements: 19.2, 19.7, 19.9_

  - [x] 2.3 Write property test for WebSocket connection stability
    - **Property 2: Connection resilience**
    - **Validates: Requirements 19.4, 19.5, 19.6**
    - Test automatic reconnection after network interruption
    - Test heartbeat failure detection and reconnection
    - Test connection pooling under load

- [x] 3. Core React component structure
  - [x] 3.1 Create CommunicationLayout component
    - Implement main layout with sidebar and content area
    - Add responsive breakpoints (640px, 768px, 1024px)
    - Implement mobile drawer for sidebar with hamburger menu
    - Add dark mode support using next-themes
    - _Requirements: 22.4, 22.13, 27.2, 27.3_

  - [x] 3.2 Create DepartmentSidebar component
    - Implement department and channel list navigation
    - Add collapsible department sections
    - Display unread message badges
    - Add presence indicators for users
    - Implement staggered entry animation with Framer Motion
    - _Requirements: 3.1, 3.2, 3.5, 22.2, 35.2, 35.6_

  - [x] 3.3 Create MessageList component with virtualization
    - Implement virtualized scrolling using @tanstack/react-virtual
    - Add lazy loading with infinite scroll (50 messages per batch)
    - Implement message grouping by date and user
    - Add smooth scroll to bottom on new messages
    - Display unread separator line
    - _Requirements: 21.1, 21.2, 21.3, 35.3_

  - [x] 3.4 Create MessageComposer component
    - Implement multi-line text input (Shift+Enter for newline, Enter to send)
    - Add character counter approaching 4000 limit
    - Implement markdown formatting toolbar (bold, italic, code)
    - Add emoji picker button
    - Add file attachment button with drag-and-drop support
    - Display file upload previews
    - Implement draft auto-save to localStorage
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 42.1, 42.4_

- [x] 4. Checkpoint - Core infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 2: Feature Build & ERP Integration (Day 2 - May 6)

- [x] 5. Real-time messaging implementation
  - [x] 5.1 Implement message sending via WebSocket
    - Create useSendMessage hook with optimistic updates
    - Implement WebSocket event handler for message.new
    - Add message delivery confirmation indicator
    - Implement offline message queueing
    - _Requirements: 1.1, 1.2, 1.5, 1.7_

  - [x] 5.2 Implement message editing and deletion
    - Create API endpoints PUT /api/messages/:messageId and DELETE /api/messages/:messageId
    - Add edit/delete buttons for message authors (24-hour edit window)
    - Display "edited" indicator on edited messages
    - Display "message deleted" placeholder for deleted messages
    - Record edit/delete actions in audit logs
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.8_

  - [x] 5.3 Implement threaded conversations
    - Create ThreadPanel component with slide-in animation
    - Add reply button to messages
    - Display thread reply count on parent messages
    - Show thread indicator icon on messages with replies
    - Implement thread notification system
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [x] 5.4 Write property test for message delivery
    - **Property 3: Message delivery latency**
    - **Validates: Requirements 1.1**
    - Test that messages are delivered within 200ms
    - Test message ordering is preserved
    - Test message delivery across multiple clients

- [x] 6. User mentions and notifications
  - [x] 6.1 Implement @ mention autocomplete
    - Create mention autocomplete dropdown triggered by @
    - Filter channel members by name as user types
    - Insert mention tag on selection
    - Highlight mentions with distinct styling
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 6.2 Implement mention notifications
    - Send push notification to mentioned users
    - Add mentioned messages to user's mentions inbox
    - Support @channel and @here mentions
    - Queue notifications for offline users
    - _Requirements: 6.3, 6.5, 6.6, 6.7, 6.8_

  - [x] 6.3 Integrate with VORP notification system
    - Insert communication notifications into VORP notifications table
    - Categorize notifications (mentions, direct messages, calls, thread replies)
    - Respect user's global notification preferences
    - Provide notification action buttons (reply, mark as read, mute)
    - _Requirements: 47.1, 47.2, 47.3, 47.4, 47.7_

- [x] 7. File attachments and media
  - [x] 7.1 Implement file upload to Supabase Storage
    - Create POST /api/upload endpoint
    - Validate file types against allowlist
    - Enforce 50MB file size limit
    - Support multiple files per message (up to 10)
    - Generate thumbnails for images
    - _Requirements: 7.1, 7.2, 7.3, 7.10_

  - [x] 7.2 Implement attachment display
    - Display inline image previews
    - Display video player for video files
    - Display download link with metadata for documents
    - Show upload progress indicator
    - Display error message on upload failure with retry option
    - _Requirements: 7.4, 7.5, 7.6, 7.8, 7.9_

  - [x] 7.3 Write unit tests for file upload validation
    - Test file size validation (reject >50MB)
    - Test file type validation (reject disallowed types)
    - Test multiple file upload (up to 10 files)
    - _Requirements: 7.2, 7.3_

- [x] 8. Emoji reactions
  - [x] 8.1 Implement emoji reaction system
    - Display reaction button on message hover
    - Create emoji picker component
    - Add reaction to message on emoji selection
    - Display reaction counts grouped by emoji type
    - Toggle user's reaction on/off when clicking existing reaction
    - Show list of users who reacted on hover
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 8.2 Support custom emoji (Admin feature)
    - Create custom emoji upload interface for admins
    - Store custom emoji in Supabase Storage
    - Display custom emoji in emoji picker
    - _Requirements: 8.7_

- [x] 9. VORP system integrations
  - [x] 9.1 Integrate with VORP RBAC system
    - Import useAuth hook from AuthContext
    - Create useCommunicationPermissions hook
    - Implement permission checks (canCreateDepartment, canCreateChannel, canDeleteChannel, canManageChannelMembers, canRecordCalls)
    - Apply role-based UI rendering (hide/show features based on permissions)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7_

  - [x] 9.2 Integrate with VORP audit log system
    - Create recordAuditEvent function
    - Log message sent/edited/deleted events
    - Log channel created/archived events
    - Log user joined/left channel events
    - Log file upload events
    - Log call start/end events
    - Include user ID, timestamp, action type, and entity details
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9_

  - [x] 9.3 Integrate with VORP user profiles
    - Fetch user profile data (full_name, profile_picture_url, role, designation, department)
    - Display user profile information in messages
    - Create UserProfilePopover component with detailed info
    - Update profile display within 5 seconds of profile changes
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

  - [x] 9.4 Implement deep links to VORP entities
    - Create deep link parser for #vendor-123, #po-456, #task-789, #mou-XXX, #issue-YYY
    - Implement autocomplete for deep link syntax
    - Create DeepLinkPreview component with entity metadata
    - Navigate to entity on deep link click
    - Display inactive styling for deleted entities
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [x] 10. Checkpoint - Core features and integrations complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 3: Security, Performance & Advanced Features (Day 3 - May 7)

- [x] 11. Security hardening
  - [x] 11.1 Implement input sanitization and XSS prevention
    - Install and configure DOMPurify for HTML sanitization
    - Create sanitizeMessage function for markdown content
    - Sanitize all user input before rendering
    - Configure allowed HTML tags and attributes
    - _Requirements: 20.1, 34.12_

  - [x] 11.2 Implement rate limiting
    - Create Redis-based rate limiter for messages (60 per minute per user)
    - Create rate limiter for file uploads (10 per minute per user)
    - Display error message when rate limit exceeded
    - Log rate limit violations
    - _Requirements: 20.3, 20.4, 20.5_

  - [x] 11.3 Implement CSRF protection and token management
    - Add CSRF token validation for state-changing operations
    - Implement 24-hour token expiry
    - Add automatic token refresh before expiry
    - Encrypt all WebSocket traffic using TLS/SSL
    - _Requirements: 20.2, 20.7, 20.8_

  - [x] 11.4 Implement file upload security
    - Validate file types against allowlist
    - Implement virus scanning integration (ClamAV or similar)
    - Validate file size limits
    - Sanitize file names
    - _Requirements: 20.6, 7.10_

  - [x] 11.5 Write security tests
    - Test XSS prevention with malicious input
    - Test CSRF token validation
    - Test rate limiting enforcement
    - Test file upload validation
    - _Requirements: 30.6_

- [x] 12. Performance optimization
  - [x] 12.1 Implement message list virtualization
    - Configure @tanstack/react-virtual for message list
    - Set estimated message height (80px)
    - Configure overscan (10 items above/below viewport)
    - Test smooth scrolling with 1000+ messages
    - _Requirements: 21.1, 21.2, 21.3_

  - [x] 12.2 Implement caching strategy
    - Configure TanStack Query with staleTime (30s) and cacheTime (5min)
    - Cache channel metadata in localStorage
    - Cache user profiles globally (5min staleTime)
    - Implement IndexedDB for offline message storage
    - _Requirements: 21.4, 21.5_

  - [x] 12.3 Implement optimistic UI updates
    - Add optimistic updates for message sending
    - Add optimistic updates for reactions
    - Implement rollback on error
    - Display sending/failed states
    - _Requirements: 21.6_

  - [x] 12.4 Implement debouncing and throttling
    - Debounce search input (300ms)
    - Throttle typing indicators (1 per second)
    - Debounce draft auto-save (500ms)
    - _Requirements: 21.10, 33.5_

  - [x] 12.5 Write performance tests
    - Test message list rendering with 1000+ messages
    - Test virtualization performance
    - Test cache hit rates
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 13. WebRTC voice and video calling
  - [x] 13.1 Implement WebRTC signaling infrastructure
    - Set up WebRTC signaling via WebSocket
    - Implement offer/answer SDP exchange
    - Implement ICE candidate exchange
    - Configure STUN/TURN servers for NAT traversal
    - _Requirements: 2.1_

  - [x] 13.2 Create CallInterface component
    - Implement participant grid layout (1-4 video streams)
    - Add call controls (mute, video toggle, screen share, end call)
    - Display call duration and participant list
    - Implement connection quality indicator
    - Add audio level indicators for participants
    - _Requirements: 2.6, 36.1, 36.7_

  - [x] 13.3 Implement call features
    - Support voice calls (up to 8 participants)
    - Support video calls (up to 4 active video streams)
    - Implement screen sharing
    - Add device selection (microphone, camera, speakers)
    - Implement echo cancellation and noise suppression
    - Auto-adjust video quality based on bandwidth
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.8, 2.10, 36.5, 36.10, 36.11, 36.12_

  - [x] 13.4 Implement incoming call notifications
    - Display incoming call notification with accept/reject options
    - Play notification sound for incoming calls
    - Show caller information
    - _Requirements: 2.9_

  - [x] 13.5 Write integration tests for WebRTC
    - Test call establishment flow
    - Test participant joining/leaving
    - Test screen sharing
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 14. User presence system
  - [x] 14.1 Implement presence tracking
    - Update user status to 'online' on connection
    - Set status to 'away' after 5 minutes of inactivity
    - Set status to 'offline' on disconnect (within 30 seconds)
    - Allow manual status setting (online, away, DND, offline)
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.7_

  - [x] 14.2 Display presence indicators
    - Show presence indicators next to user names (green, yellow, red, gray)
    - Display last seen timestamp for offline users
    - Update presence in real-time via WebSocket
    - _Requirements: 10.1, 10.6, 10.8_

  - [x] 14.3 Implement custom status messages
    - Allow users to set custom status (up to 100 characters)
    - Provide preset status options (In a meeting, On vacation, Working remotely, Busy)
    - Add emoji support to status messages
    - Implement status expiration (1 hour, 4 hours, today, this week, custom)
    - Auto-clear expired status messages
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 41.5, 41.6_

- [x] 15. Full-text search implementation
  - [x] 15.1 Create search interface
    - Create SearchModal component with keyboard shortcut (Cmd/Ctrl+K)
    - Implement search input with debouncing (300ms)
    - Add search filters (date range, channel, sender)
    - Display search results with message context and highlighting
    - _Requirements: 9.1, 9.5, 9.6, 9.7_

  - [x] 15.2 Implement backend search
    - Create GET /api/search endpoint
    - Use PostgreSQL full-text search with GIN indexes
    - Search across message content, sender names, and channel names
    - Return results within 1 second
    - Limit search to user's accessible channels
    - _Requirements: 9.2, 9.3, 9.4, 9.9_

  - [x] 15.3 Implement search result navigation
    - Navigate to message in original context on click
    - Highlight search terms in results
    - Display result count and pagination
    - _Requirements: 9.8_

- [x] 16. Checkpoint - Security, performance, and advanced features complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 4: Additional Features & Polish (Day 4 - May 8)

- [x] 17. Direct messaging
  - [x] 17.1 Implement direct message infrastructure
    - Create DirectMessageList component
    - Implement POST /api/direct-messages endpoint
    - Create GET /api/direct-messages endpoint for conversation list
    - Display conversations with last message and unread count
    - _Requirements: 13.1, 13.2, 13.3, 13.7_

  - [x] 17.2 Implement direct message features
    - Support all message features (attachments, reactions, threads)
    - Send push notifications for new direct messages
    - Display user presence in conversation list
    - _Requirements: 13.4, 13.6, 13.8_

  - [x] 17.3 Write unit tests for direct messaging
    - Test conversation creation
    - Test message sending in DMs
    - Test unread count tracking
    - _Requirements: 13.1, 13.2, 13.7_

- [x] 18. Channel management features
  - [x] 18.1 Implement department and channel creation
    - Create POST /api/departments endpoint (Admin only)
    - Create POST /api/channels endpoint
    - Add department creation dialog
    - Add channel creation dialog with privacy option
    - _Requirements: 3.1, 3.2, 3.8, 14.1_

  - [x] 18.2 Implement channel settings
    - Create channel settings dialog
    - Allow editing channel name, description, and purpose
    - Display member list with role indicators
    - Add/remove channel members
    - Transfer channel ownership
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [x] 18.3 Implement private channels
    - Mark channels as private on creation
    - Display lock icon on private channels
    - Require invitation for private channel membership
    - Send invitation notifications
    - Hide private channels from non-members
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 18.4 Implement channel archiving
    - Add archive channel action (Admin only)
    - Prevent new messages in archived channels
    - Maintain read-only access to archived messages
    - Move archived channels to separate section
    - Allow unarchiving channels
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.7_

  - [x] 18.5 Implement pinned messages
    - Add pin message action
    - Display pinned messages in channel header
    - Limit to 10 pinned messages per channel
    - Allow unpinning messages
    - _Requirements: 26.9, 26.10, 26.11_

- [x] 19. Message formatting and rich text
  - [x] 19.1 Implement markdown rendering
    - Support bold (**text**), italic (*text*), strikethrough (~~text~~)
    - Support inline code (`code`) and code blocks (```language\ncode\n```)
    - Implement syntax highlighting for code blocks (JavaScript, TypeScript, Python, SQL, JSON)
    - Support bulleted lists (- or *) and numbered lists (1.)
    - Support blockquotes (>)
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7, 34.8, 34.9_

  - [x] 19.2 Implement link handling
    - Auto-linkify URLs
    - Generate link previews with title, description, and thumbnail
    - Support link previews for common websites (YouTube, Twitter, GitHub)
    - Display inline image previews for direct image URLs
    - Display inline video players for direct video URLs
    - _Requirements: 34.10, 34.11, 45.1, 45.2, 45.3, 45.5, 45.6_

  - [x] 19.3 Implement formatting toolbar
    - Add formatting buttons (bold, italic, code, list)
    - Insert markdown syntax on button click
    - Show keyboard shortcuts in tooltips
    - _Requirements: 25.12_

- [x] 20. Unread message tracking
  - [x] 20.1 Implement unread tracking system
    - Track last_read_at timestamp in channel_members table
    - Calculate unread count for each channel
    - Display unread badges on channels
    - Display unread separator line in message list
    - _Requirements: 35.1, 35.2, 35.3_

  - [x] 20.2 Implement mark as read functionality
    - Mark messages as read after 2 seconds of viewing
    - Update last_read_at timestamp
    - Sync read status across devices in real-time
    - Provide "Mark all as read" action
    - _Requirements: 35.4, 35.8, 35.10_

  - [x] 20.3 Implement unread UI features
    - Display total unread count in browser tab title
    - Highlight channels with unread messages
    - Sort channels with unread messages to top
    - Persist read status across sessions
    - _Requirements: 35.5, 35.6, 35.7, 35.9_

- [ ] 21. Notification preferences
  - [-] 21.1 Create notification preferences UI
    - Add notification settings in user settings
    - Toggle push notifications on/off
    - Toggle email digests on/off
    - Configure email digest frequency (immediate, hourly, daily, never)
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 21.2 Implement channel muting
    - Add mute channel action
    - Suppress notifications for muted channels (except direct mentions)
    - Display muted indicator on channels
    - _Requirements: 24.5, 24.6_

  - [~] 21.3 Implement notification sounds and quiet hours
    - Allow users to configure notification sounds
    - Implement quiet hours feature
    - Suppress notifications during quiet hours
    - Persist preferences in database
    - Sync preferences across devices
    - _Requirements: 24.7, 24.8, 24.9, 24.10_

- [ ] 22. Message bookmarks and saved items
  - [~] 22.1 Implement bookmark functionality
    - Add bookmark action on message hover
    - Create message_bookmarks table entry
    - Display "Saved items" view in sidebar
    - Show bookmarked messages with channel context
    - _Requirements: 38.1, 38.2, 38.3, 38.4_

  - [~] 22.2 Implement bookmark features
    - Allow removing bookmarks
    - Add notes to bookmarked messages
    - Organize bookmarks with custom tags
    - Search within saved items
    - Handle deleted message bookmarks
    - Sync bookmarks across devices
    - _Requirements: 38.5, 38.6, 38.7, 38.8, 38.9, 38.10_

- [ ] 23. Message reminders
  - [~] 23.1 Implement reminder system
    - Add reminder action on message hover
    - Provide preset reminder times (20 min, 1 hour, 3 hours, tomorrow, next week, custom)
    - Create message_reminders table entry
    - Send notification when reminder triggers
    - _Requirements: 44.1, 44.2, 44.3, 44.8_

  - [~] 23.2 Implement reminder management
    - Display active reminders in dedicated list
    - Allow cancelling reminders
    - Allow snoozing triggered reminders
    - Support recurring reminders (daily, weekly, monthly)
    - Sync reminders across devices
    - Send reminders even when user is offline
    - _Requirements: 44.4, 44.5, 44.6, 44.7, 44.9, 44.10_

- [ ] 24. Slash commands
  - [~] 24.1 Implement slash command system
    - Detect / character in composer
    - Display command menu with available commands
    - Filter commands based on user permissions
    - Provide autocomplete for command parameters
    - _Requirements: 43.1, 43.10, 43.11, 43.12_

  - [~] 24.2 Implement core slash commands
    - /mute - Mute current channel
    - /unmute - Unmute current channel
    - /remind - Set message reminder
    - /call - Start voice call
    - /video - Start video call
    - /invite - Invite users to channel
    - /archive - Archive channel (Admin only)
    - /search - Open search with pre-filled query
    - _Requirements: 43.2, 43.3, 43.4, 43.5, 43.6, 43.7, 43.8, 43.9_

- [ ] 25. Message polls
  - [~] 25.1 Implement poll creation
    - Create poll creation interface in composer
    - Support up to 10 poll options
    - Support single-choice and multiple-choice polls
    - Allow setting poll expiration time
    - Allow anonymous voting option
    - _Requirements: 46.1, 46.2, 46.3, 46.5, 46.7_

  - [~] 25.2 Implement poll voting and results
    - Display poll results in real-time
    - Prevent voting after poll expires
    - Show who voted for each option (unless anonymous)
    - Allow poll creators to close polls early
    - Send notifications for new polls
    - Allow users to change votes before poll closes
    - _Requirements: 46.4, 46.6, 46.8, 46.9, 46.10, 46.11_

- [~] 26. Checkpoint - Additional features complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5: Calendar Integration, Call Recording & Mobile (Day 5 - May 9)

- [ ] 27. VORP Calendar integration
  - [~] 27.1 Implement call scheduling
    - Create call scheduling interface
    - Integrate with VORP calendar_events table
    - Create calendar event on call schedule
    - Send invitations to participants
    - Support recurring calls (daily, weekly, monthly)
    - _Requirements: 39.1, 39.2, 39.5, 39.6_

  - [~] 27.2 Display upcoming calls
    - Show upcoming scheduled calls in channel header
    - Display notification with join button when call time arrives
    - Allow accepting/declining call invitations
    - Remove calendar event when call is cancelled
    - Support timezone-aware scheduling
    - _Requirements: 39.3, 39.4, 39.7, 39.8, 39.10_

  - [~] 27.3 Link recordings to calendar
    - Display call recordings linked to calendar events
    - Show recording duration and participants
    - _Requirements: 39.9_

- [ ] 28. Call recording and playback
  - [~] 28.1 Implement call recording (Manager/Admin only)
    - Add start recording button in call interface
    - Notify all participants when recording starts
    - Store recordings in Supabase Storage
    - Process and save recording within 2 minutes of call end
    - Require explicit consent from participants
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 40.10_

  - [~] 28.2 Implement recording playback
    - Display recorded calls in channel
    - Add playback controls (play, pause, seek)
    - Support playback speed adjustment (0.5x, 1x, 1.5x, 2x)
    - _Requirements: 40.5, 40.6_

  - [~] 28.3 Implement call transcription
    - Generate automatic transcripts for recorded calls
    - Allow searching within call transcripts
    - Display transcript alongside recording
    - _Requirements: 40.7, 40.8_

  - [~] 28.4 Implement recording retention policy
    - Configure retention policy (Admin setting)
    - Auto-delete recordings after retention period
    - Log recording deletions in audit logs
    - _Requirements: 40.9_

- [ ] 29. Mobile browser optimization
  - [~] 29.1 Implement responsive layout
    - Test breakpoints at 640px, 768px, and 1024px
    - Collapse sidebar into drawer on mobile (<768px)
    - Add hamburger menu for mobile navigation
    - Auto-hide sidebar after channel selection on mobile
    - _Requirements: 27.1, 27.2, 27.3, 27.10_

  - [~] 29.2 Implement mobile gestures
    - Add swipe gesture to open/close sidebar
    - Implement pull-to-refresh for message reload
    - Optimize touch targets to minimum 44x44 pixels
    - _Requirements: 27.4, 27.5, 27.9_

  - [~] 29.3 Optimize for mobile performance
    - Support mobile browser notifications using Push API
    - Optimize image loading for mobile bandwidth
    - Support mobile camera access for photo uploads
    - Test on iOS Safari and Android Chrome
    - _Requirements: 27.6, 27.7, 27.8, 30.9_

- [ ] 30. Offline support
  - [~] 30.1 Implement offline detection
    - Display offline indicator when connection lost
    - Cache recent messages in IndexedDB
    - Cache channel list and metadata
    - Cache user profiles
    - _Requirements: 48.1, 48.2, 48.5, 48.6_

  - [~] 30.2 Implement offline message composition
    - Allow composing messages while offline
    - Queue messages for sending when online
    - Auto-send queued messages on reconnection
    - Display cached content with offline indicators
    - _Requirements: 48.3, 48.4, 48.7_

- [ ] 31. Channel discovery and search
  - [~] 31.1 Create channel browser
    - Display all accessible channels
    - Filter channels by department
    - Search channels by name and description
    - Display channel metadata (member count, last activity)
    - _Requirements: 37.1, 37.2, 37.3, 37.4_

  - [~] 31.2 Implement channel joining
    - Allow previewing public channel messages
    - Add "Join channel" action for public channels
    - Add "Request to join" action for private channels
    - Notify admins of join requests
    - _Requirements: 37.5, 37.6, 37.7, 37.8_

  - [~] 31.3 Implement channel recommendations
    - Display trending channels based on activity
    - Show recommended channels based on user's department and role
    - _Requirements: 37.9, 37.10_

- [ ] 32. Typing indicators
  - [~] 32.1 Implement typing indicator system
    - Broadcast typing indicator via WebSocket
    - Display "User is typing..." below message list
    - Handle multiple users typing
    - Auto-clear indicators after 3 seconds of inactivity
    - Debounce broadcasts to max 1 per second
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5_

  - [~] 32.2 Add typing indicators to DMs and threads
    - Display typing indicators in direct messages
    - Display typing indicators in threads
    - Use WebSocket for real-time delivery
    - _Requirements: 33.6, 33.7, 33.8_

- [ ] 33. Message drafts
  - [~] 33.1 Implement draft auto-save
    - Auto-save message drafts to localStorage on navigation
    - Display draft indicator on channels with unsent messages
    - Restore drafts when returning to channel
    - Save drafts for DMs and threads
    - _Requirements: 42.1, 42.2, 42.3, 42.5_

  - [~] 33.2 Implement draft management
    - Preserve draft formatting and attachments
    - Clear draft when message is sent
    - Allow manually discarding drafts
    - Retain drafts for up to 7 days
    - Sync drafts across browser tabs
    - _Requirements: 42.6, 42.7, 42.8, 42.9, 42.10_

- [~] 34. Checkpoint - Calendar, recording, mobile, and polish complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 6: Testing, Monitoring & Documentation (Day 5 - May 9 continued)

- [ ] 35. Comprehensive testing
  - [~] 35.1 Write unit tests for business logic
    - Test message validation functions
    - Test permission checking functions
    - Test deep link parsing
    - Test markdown rendering
    - Test rate limiting logic
    - Achieve minimum 80% code coverage
    - _Requirements: 30.1_

  - [~] 35.2 Write integration tests for API endpoints
    - Test POST /api/departments
    - Test POST /api/channels
    - Test GET /api/messages/:channelId with pagination
    - Test PUT /api/messages/:messageId
    - Test DELETE /api/messages/:messageId
    - Test POST /api/messages/:messageId/reactions
    - Test GET /api/search
    - Test POST /api/upload
    - _Requirements: 30.2_

  - [~] 35.3 Write end-to-end tests for critical flows
    - Test send message flow (compose → send → display)
    - Test create channel flow (create → join → send message)
    - Test join call flow (initiate → connect → end)
    - Test file upload flow (select → upload → display)
    - _Requirements: 30.3_

  - [~] 35.4 Write load and performance tests
    - Simulate 500 concurrent users
    - Test WebSocket connection stability under load
    - Test message delivery latency under load
    - Test database query performance
    - _Requirements: 30.4, 30.5_

  - [~] 35.5 Write accessibility tests
    - Run axe-core automated accessibility tests
    - Test keyboard navigation
    - Test screen reader compatibility
    - Verify WCAG 2.1 AA compliance
    - _Requirements: 30.7, 23.1, 23.2_

  - [~] 35.6 Write cross-browser compatibility tests
    - Test on Chrome (latest)
    - Test on Firefox (latest)
    - Test on Safari (latest)
    - Test on Edge (latest)
    - Test on iOS Safari
    - Test on Android Chrome
    - _Requirements: 30.8, 30.9_

- [ ] 36. Monitoring and observability
  - [~] 36.1 Implement error logging
    - Log all errors with stack traces
    - Send errors to centralized logging system
    - Include user context and request metadata
    - _Requirements: 31.1_

  - [~] 36.2 Implement metrics tracking
    - Track WebSocket connection metrics (active connections, failures, reconnections)
    - Track message delivery metrics (sent, latency, failed)
    - Track API endpoint performance (response time, error rate, throughput)
    - Track database query performance
    - _Requirements: 31.2, 31.3, 31.4, 31.5_

  - [~] 36.3 Implement health checks and alerts
    - Create GET /api/health endpoint
    - Alert when error rate exceeds 5% over 5 minutes
    - Alert when message delivery latency exceeds 1 second
    - Alert when WebSocket failure rate exceeds 10%
    - _Requirements: 31.6, 31.7, 31.8, 31.9_

  - [~] 36.4 Create monitoring dashboard
    - Display real-time metrics
    - Show system health status
    - Display active connections count
    - Show message throughput
    - _Requirements: 31.10_

- [ ] 37. Data retention and compliance
  - [~] 37.1 Implement data retention policies
    - Retain all messages indefinitely by default
    - Allow Admin to configure retention period
    - Implement automatic message deletion after retention period
    - Retain deleted message metadata in audit logs
    - _Requirements: 32.1, 32.2, 32.3_

  - [~] 37.2 Implement data export functionality
    - Create export interface for compliance requests
    - Support exporting user messages in JSON format
    - Support exporting channel messages in JSON format
    - Support exporting messages by date range
    - Encrypt exported data files
    - Log all export operations in audit logs
    - _Requirements: 32.4, 32.5, 32.6, 32.7, 32.8, 32.9_

  - [~] 37.3 Implement legal hold feature
    - Allow Admin to place legal hold on messages/channels
    - Prevent deletion of messages under legal hold
    - Display legal hold indicator
    - _Requirements: 32.10_

- [ ] 38. UI/UX polish and animations
  - [~] 38.1 Implement Framer Motion animations
    - Add staggered entry animation for channel list (50ms stagger)
    - Add message entry animation (fade-in, 300ms)
    - Add hover animations for messages (background color transition)
    - Add button hover/tap animations (scale 1.02/0.98)
    - Add thread panel slide-in animation (spring physics)
    - Add typing indicator animation (bouncing dots)
    - _Requirements: 22.2, 22.8, 22.9_

  - [~] 38.2 Implement loading states
    - Add skeleton loaders for message list
    - Add skeleton loaders for channel list
    - Add shimmer effect for inline loading
    - Add loading spinners for async operations
    - _Requirements: 22.7_

  - [~] 38.3 Implement empty states
    - Add "No messages yet" empty state
    - Add "No search results" empty state
    - Add "No channels" empty state
    - Add "No saved items" empty state
    - _Requirements: 22.4_

  - [~] 38.4 Ensure design system compliance
    - Use sentence case for all UI text (no ALL CAPS)
    - Apply correct font hierarchy (Montserrat for titles, Poppins for body)
    - Use semantic color variables (success, warning, info, destructive)
    - Implement proper focus indicators (2px outline)
    - Ensure 44x44px minimum touch targets on mobile
    - _Requirements: 22.1, 22.12, 27.5_

- [ ] 39. Documentation
  - [~] 39.1 Write API documentation
    - Document all REST API endpoints with request/response examples
    - Document WebSocket events with payload schemas
    - Document authentication and authorization
    - Document rate limiting rules
    - _Requirements: 29.1-29.15_

  - [~] 39.2 Write component documentation
    - Document all React components with props and usage examples
    - Document custom hooks with parameters and return values
    - Document utility functions
    - _Requirements: Internal documentation_

  - [~] 39.3 Write deployment guide
    - Document environment variables
    - Document database migration process
    - Document WebSocket server deployment
    - Document Redis configuration
    - Document STUN/TURN server setup
    - _Requirements: Internal documentation_

  - [~] 39.4 Write user guide
    - Document how to send messages
    - Document how to create channels
    - Document how to start calls
    - Document how to use advanced features (threads, bookmarks, reminders)
    - _Requirements: Internal documentation_

- [ ] 40. Final integration and wiring
  - [~] 40.1 Integrate Communication module into VORP navigation
    - Add "Communication" link to main sidebar
    - Add route /communication to App.tsx
    - Ensure protected route with authentication
    - Add communication icon to navigation
    - _Requirements: 4.2_

  - [~] 40.2 Wire all components together
    - Connect CommunicationLayout with all child components
    - Ensure WebSocket connection is established on mount
    - Ensure proper cleanup on unmount
    - Test navigation between channels
    - Test navigation between DMs
    - Test opening/closing threads
    - _Requirements: All requirements_

  - [~] 40.3 Test all VORP integrations
    - Test RBAC integration (role-based feature visibility)
    - Test audit log integration (all actions logged)
    - Test user profile integration (profile data displayed correctly)
    - Test calendar integration (scheduled calls appear in calendar)
    - Test notification integration (notifications appear in VORP notification center)
    - Test deep links (clicking entity links navigates correctly)
    - _Requirements: 4.1-4.8, 16.1-16.8, 17.1-17.8, 18.1-18.9, 39.1-39.10, 47.1-47.10_

  - [~] 40.4 Perform full system integration test
    - Test complete user journey (login → create channel → send message → start call → end call)
    - Test multi-user scenarios (2+ users in same channel)
    - Test cross-device scenarios (same user on multiple devices)
    - _Requirements: All requirements_

- [~] 41. Final checkpoint - Complete system ready for UAT
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the sprint
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation follows the 5-day sprint timeline with clear phase boundaries
- All code follows VORP design system guidelines (sentence case, Framer Motion animations, shadcn/ui components)
- Security, performance, and accessibility are built-in from the start, not added later

## Success Criteria

The Communication Module is complete when:
1. All non-optional tasks are implemented and tested
2. All requirements are covered by implementation tasks
3. The module integrates seamlessly with existing VORP systems (RBAC, audit logs, profiles, calendar, notifications)
4. Real-time messaging works reliably with <200ms latency
5. Voice/video calls work on desktop and mobile browsers
6. The UI follows VORP design system standards
7. Security measures are in place (input sanitization, rate limiting, encryption)
8. Performance optimizations are implemented (virtualization, caching, optimistic updates)
9. The system is accessible (WCAG 2.1 AA compliant)
10. Comprehensive monitoring and logging are in place

