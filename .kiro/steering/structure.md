# Project Structure

## Root Directory
```
├── .agents/              # Agent workflows and automation configs
├── .kiro/                # Kiro IDE configuration and steering files
├── .lovable/             # Lovable platform configuration
├── docs/                 # Feature specifications and documentation
├── public/               # Static assets (logo, sounds, robots.txt)
├── src/                  # Application source code
├── supabase/             # Supabase migrations and edge functions
└── dist/                 # Production build output (generated)
```

## Source Code Organization (`src/`)

### Core Application Files
- `App.tsx` - Root component with routing, providers, error boundary
- `App.css` - Global application styles
- `index.css` - Tailwind imports and custom CSS utilities
- `main.tsx` - Application entry point

### Component Architecture (`src/components/`)

#### Domain Components
```
components/
├── analytics/          # Data export, reporting components
├── contexts/           # React contexts (AuthContext)
├── dashboard/          # Dashboard widgets (MOUActivity, EmployeeVendor)
├── hr/                 # HR module components (tabs, org chart, performance)
├── issues/             # Issue tracking (IssueForm, IssueAIAssistant)
├── mous/               # MOU management (forms, vault, wizard, versioning)
│   └── wizard/         # Multi-step MOU creation wizard
├── projects/           # Project management board
├── settings/           # Application settings
├── vendors/            # Vendor management (forms, details, protected routes)
└── layout/             # Layout components (DashboardLayout, Sidebar)
```

#### Infrastructure Components
```
components/
├── hooks/              # Custom React hooks (data fetching, business logic)
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and type definitions
├── lib/                # Utility functions (cn, utils)
├── ui/                 # shadcn/ui components (buttons, cards, dialogs, etc.)
└── utils/              # Helper utilities
```

### Pages (`src/pages/`)
Page components that map to routes:
- `Login.tsx` - Authentication
- `Dashboard.tsx` - Main dashboard
- `Vendors.tsx` - Vendor listing
- `VendorDetail.tsx` - Individual vendor view
- `Issues.tsx` - Issue tracking
- `MOUs.tsx` - MOU management
- `MOUVault.tsx` - Document vault
- `Analytics.tsx` - Analytics dashboard
- `AuditLogs.tsx` - Audit trail
- `Calendar.tsx` - Unified calendar view
- `Notifications.tsx` - Notification center
- `Settings.tsx` - User settings
- `UserApprovals.tsx` - Admin user approval (admin only)
- `HRPerformance.tsx` - HR module (staff only)
- `NotFound.tsx` - 404 page

### Custom Hooks (`src/components/hooks/`)
Business logic and data fetching hooks:
- `useAnalytics.ts` - Analytics data
- `useAppraisals.ts` - Performance reviews
- `useAttendance.ts` - Attendance tracking
- `useAuditLogs.ts` - Audit log queries
- `useEmployeeLifecycle.ts` - Employee history
- `useEmployeePerformance.ts` - Performance scoring
- `useIssues.ts` - Issue CRUD operations
- `useLeaveRequests.ts` - Leave management
- `useManagerAuditAccess.ts` - Manager permissions
- `useMOUs.ts` - MOU operations
- `useMOUVault.ts` - Document vault operations
- `useNotificationPreferences.ts` - User notification settings
- `useReportingLines.ts` - Org hierarchy
- `useResourcePlanning.ts` - Resource allocation
- `useTimeTracking.ts` - Time logs
- `useUsers.ts` - User management
- `useVendorPayments.ts` - Payment tracking
- `useVendorRemarks.ts` - Vendor notes
- `useVendors.ts` - Vendor CRUD

## Routing Structure
```
/                       → Login (public)
/dashboard              → Dashboard (protected)
/vendors                → Vendor list (protected)
/vendors/:id            → Vendor detail (protected)
/issues                 → Issue tracking (protected)
/mous                   → MOU management (protected)
/mou-vault              → Document vault (protected)
/analytics              → Analytics (protected)
/audit-logs             → Audit logs (protected)
/notifications          → Notifications (protected)
/calendar               → Calendar (protected)
/settings               → Settings (protected)
/user-approvals         → User approvals (admin only)
/hr-performance         → HR module (staff only)
/projects               → Project board (protected)
```

## Naming Conventions

### Files
- **Components**: PascalCase (e.g., `VendorDetail.tsx`, `IssueForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useVendors.ts`, `useAuth.ts`)
- **Utilities**: camelCase (e.g., `utils.ts`, `client.ts`)
- **Types**: PascalCase (e.g., `types.ts`)

### Code
- **Components**: PascalCase (e.g., `DashboardLayout`, `MOUVaultCard`)
- **Functions**: camelCase (e.g., `handleSubmit`, `fetchVendors`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `SUPABASE_URL`, `MAX_FILE_SIZE`)
- **Types/Interfaces**: PascalCase (e.g., `Vendor`, `IssueStatus`)

## Import Aliases
Path aliases configured in `tsconfig.json` and `vite.config.ts`:
- `@/` → `src/`
- `@/components` → `src/components`
- `@/hooks` → `src/components/hooks`
- `@/lib` → `src/components/lib`
- `@/ui` → `src/components/ui`
- `@/contexts` → `src/components/contexts`
- `@/integrations` → `src/components/integrations`
- `@/pages` → `src/pages`

## Key Architectural Patterns

### Component Composition
- Page components import from `src/components/pages/` (re-exports)
- Layout wrapper pattern (`DashboardLayout`) for consistent page structure
- Compound components for complex UI (e.g., MOU wizard steps)

### Data Flow
- TanStack Query for server state (caching, refetching, optimistic updates)
- Custom hooks encapsulate data fetching and business logic
- Context API for global state (AuthContext)
- Local state with useState for UI-only state

### Protected Routes
- `ProtectedRoute` wrapper component checks authentication
- Role-based rendering with `hasPermission()` from AuthContext
- Admin-only routes use `requireAdmin` prop
- Staff-only routes use `requireStaff` prop

### Styling Approach
- Tailwind utility classes for styling
- CSS variables for theming (light/dark mode)
- Custom animations defined in `tailwind.config.ts`
- Component variants using `class-variance-authority`
- Utility function `cn()` for conditional class merging
