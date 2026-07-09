# Communication Module - Layout Components

## Overview

The Communication Module provides a Slack-like real-time communication system for the Lazeez VORP platform. This directory contains the core layout components that establish the responsive structure for the communication interface.

## Components

### CommunicationLayout

Main layout wrapper component that provides the foundational structure for the communication module.

**Features:**
- Fixed sidebar (280px) on desktop screens
- Responsive mobile drawer with hamburger menu
- Smooth Framer Motion animations
- Dark mode support via next-themes
- Full accessibility compliance

**Props:**
```typescript
interface CommunicationLayoutProps {
  children: React.ReactNode;  // Main content area
  sidebar?: React.ReactNode;  // Sidebar content (departments, channels)
}
```

**Usage:**
```tsx
import { CommunicationLayout, CommunicationSidebarContainer, CommunicationContentContainer } from '@/components/communication';

function CommunicationPage() {
  return (
    <CommunicationLayout
      sidebar={
        <CommunicationSidebarContainer>
          {/* Department and channel navigation */}
        </CommunicationSidebarContainer>
      }
    >
      <CommunicationContentContainer>
        {/* Message list and composer */}
      </CommunicationContentContainer>
    </CommunicationLayout>
  );
}
```

**Responsive Behavior:**
- **Desktop (≥768px)**: Fixed sidebar visible, 280px width
- **Tablet (640px-768px)**: Sidebar collapses to drawer
- **Mobile (<640px)**: Hamburger menu with slide-out drawer

**Requirements Met:**
- ✅ Requirement 22.4: Sidebar with department and channel list
- ✅ Requirement 22.13: Responsive layout for mobile browsers
- ✅ Requirement 27.2: Responsive breakpoints (640px, 768px, 1024px)
- ✅ Requirement 27.3: Mobile drawer with hamburger menu

### DepartmentSidebar

Navigation component for departments, channels, and direct messages with real-time features.

**Features:**
- Collapsible department sections with smooth animations
- Channel list with unread message badges
- Private channel indicators (lock icon)
- Direct messages section with presence indicators
- Real-time search/filter functionality
- Staggered entry animations (50ms delay)
- Loading skeleton states
- Empty state handling

**Props:**
```typescript
interface DepartmentSidebarProps {
  departments?: Department[];
  directMessages?: DirectMessage[];
  activeChannelId?: string;
  activeDMId?: string;
  onChannelSelect?: (channelId: string) => void;
  onDMSelect?: (dmId: string) => void;
  onCreateChannel?: () => void;
  onCreateDM?: () => void;
  isLoading?: boolean;
}
```

**Usage:**
```tsx
import { DepartmentSidebar } from '@/components/communication';

<DepartmentSidebar
  departments={departments}
  directMessages={directMessages}
  activeChannelId={activeChannelId}
  onChannelSelect={handleChannelSelect}
  onDMSelect={handleDMSelect}
  onCreateChannel={handleCreateChannel}
  onCreateDM={handleCreateDM}
  isLoading={isLoading}
/>
```

**Features Detail:**
- **Collapsible Sections**: Departments expand/collapse with chevron indicators
- **Unread Badges**: Display count up to 99 (shows "99+" for higher)
- **Presence Indicators**: Green (online), Yellow (away), Red (DND), Gray (offline)
- **Search**: Real-time filtering of channels and DMs
- **Private Channels**: Lock icon for private, hash icon for public
- **Animations**: Staggered entry (50ms), hover effects (200ms)

**Requirements Met:**
- ✅ Requirement 3.1: Department and channel list navigation
- ✅ Requirement 3.2: Collapsible department sections
- ✅ Requirement 3.5: Channel membership display
- ✅ Requirement 10.1: User presence indicators
- ✅ Requirement 13.2: Direct messages section
- ✅ Requirement 14.3: Private channel indicators
- ✅ Requirement 22.2: Framer Motion animations
- ✅ Requirement 35.2: Unread message badges
- ✅ Requirement 35.6: Staggered entry animation

### PresenceIndicator

Standalone component for displaying user presence status.

**Props:**
```typescript
interface PresenceIndicatorProps {
  status: "online" | "away" | "dnd" | "offline";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}
```

**Usage:**
```tsx
import { PresenceIndicator } from '@/components/communication';

<PresenceIndicator status="online" size="md" showLabel={true} />
```

**Status Colors:**
- **Online**: Green dot
- **Away**: Yellow dot
- **DND**: Red dot
- **Offline**: Gray dot

### CommunicationSidebarContainer

Container component for sidebar content with consistent styling.

**Props:**
```typescript
interface CommunicationSidebarContainerProps {
  children: React.ReactNode;
}
```

**Features:**
- Full height flex container
- Theme-aware background
- Consistent padding and spacing

**Usage:**
```tsx
<CommunicationSidebarContainer>
  <div className="p-4 border-b border-border">
    <h2 className="font-semibold text-lg">Channels</h2>
  </div>
  <ScrollArea className="flex-1">
    {/* Channel list */}
  </ScrollArea>
</CommunicationSidebarContainer>
```

### CommunicationContentContainer

Container component for main content area with consistent styling.

**Props:**
```typescript
interface CommunicationContentContainerProps {
  children: React.ReactNode;
  className?: string;  // Optional additional classes
}
```

**Features:**
- Full height flex container
- Theme-aware background
- Supports custom className for extensions

**Usage:**
```tsx
<CommunicationContentContainer>
  <div className="p-4 border-b border-border">
    {/* Channel header */}
  </div>
  <ScrollArea className="flex-1">
    {/* Message list */}
  </ScrollArea>
  <div className="p-4 border-t border-border">
    {/* Message composer */}
  </div>
</CommunicationContentContainer>
```

## Design System Compliance

### Typography
- **Page titles**: `font-semibold text-lg` (Poppins)
- **Body text**: `font-normal text-sm` (Poppins)
- **Labels**: `font-medium text-sm text-muted-foreground`
- **No ALL CAPS** - uses sentence case throughout

### Animations
- **Sidebar entry**: Spring animation (300ms, stiffness: 300, damping: 30)
- **Mobile drawer**: Slide-in animation (200ms)
- **Hover states**: Smooth transitions (200ms)

### Colors
- Uses semantic CSS variables: `bg-background`, `border-border`, `text-foreground`
- Full dark mode support via `next-themes`
- Maintains WCAG AA contrast standards

### Accessibility
- ✅ Semantic HTML (`<aside>`, `<main>`)
- ✅ ARIA labels for icon-only buttons
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Visible focus indicators

## Responsive Breakpoints

```css
/* Mobile First */
Default: < 640px   - Mobile drawer only
sm: 640px          - Small tablets
md: 768px          - Sidebar becomes visible
lg: 1024px         - Full desktop layout
```

## Testing

Comprehensive test suite covering:
- ✅ Basic rendering
- ✅ Layout structure
- ✅ Responsive behavior
- ✅ Dark mode support
- ✅ Accessibility compliance
- ✅ Requirements validation

**Run tests:**
```bash
npm run test -- src/components/communication/__tests__/CommunicationLayout.test.tsx
```

## Demo Component

Demonstration components are provided to showcase the components in action:

**CommunicationLayoutDemo:**
```tsx
import { CommunicationLayoutDemo } from '@/components/communication';

// Use in development to preview the layout
<CommunicationLayoutDemo />
```

**DepartmentSidebarDemo:**
```tsx
import { DepartmentSidebarDemo } from '@/components/communication';

// Use in development to preview the sidebar with sample data
<DepartmentSidebarDemo />
```

The demo components include:
- Sample departments with multiple channels
- Direct messages with different presence states
- Unread message badges
- Private channel examples
- Interactive selection handlers

## Integration with VORP

The Communication Layout integrates seamlessly with existing VORP systems:

- **Theme System**: Uses `next-themes` for dark mode (same as rest of VORP)
- **UI Components**: Built with shadcn/ui components
- **Styling**: Tailwind CSS with VORP design tokens
- **Animations**: Framer Motion (consistent with VORP patterns)

## Future Enhancements

Planned components for upcoming tasks:
- ✅ `DepartmentSidebar` - Department and channel navigation (Task 3.2 - **COMPLETE**)
- `MessageList` - Virtualized message display (Task 3.3)
- `MessageComposer` - Rich text input (Task 3.4)
- `ThreadPanel` - Threaded conversations
- `CallInterface` - Voice/video calling UI

## Architecture Notes

### Layout Strategy
The layout uses a flex-based approach:
```
┌─────────────────────────────────────┐
│  CommunicationLayout (flex row)     │
│  ┌──────────┬────────────────────┐  │
│  │ Sidebar  │  Main Content      │  │
│  │ (280px)  │  (flex-1)          │  │
│  │          │                    │  │
│  │ Fixed    │  Flexible          │  │
│  │ Width    │  Width             │  │
│  └──────────┴────────────────────┘  │
└─────────────────────────────────────┘
```

### Mobile Strategy
On mobile, the sidebar is hidden and accessible via a Sheet component:
```
┌─────────────────────────────────────┐
│  Mobile Header (hamburger + title)  │
├─────────────────────────────────────┤
│                                     │
│  Main Content (full width)          │
│                                     │
└─────────────────────────────────────┘

[Hamburger Click] → Sheet slides in from left
```

### Performance Considerations
- Framer Motion animations use GPU-accelerated transforms
- Sidebar content is rendered but hidden on mobile (no re-render on toggle)
- Sheet component uses portal for optimal rendering

## Related Documentation

- [Communication Module Design](/.kiro/specs/communication-module/design.md)
- [Communication Module Requirements](/.kiro/specs/communication-module/requirements.md)
- [Communication Module Tasks](/.kiro/specs/communication-module/tasks.md)
- [VORP Design System](/.agents/workflows/design-system.md)

## Support

For questions or issues with the Communication Layout:
1. Check the test suite for usage examples
2. Review the demo component for implementation patterns
3. Consult the design document for architectural decisions
4. Refer to the requirements document for feature specifications
