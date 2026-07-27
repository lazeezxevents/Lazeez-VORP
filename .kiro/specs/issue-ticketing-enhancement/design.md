# Issue Ticketing System Enhancement - Technical Design

## Executive Summary

This document outlines the technical architecture, database schema, component design, and API specifications for enhancing the Lazeez VORP issue ticketing system with enterprise-grade capabilities.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Issue List   │  │ Issue Detail │  │  Analytics   │  │
│  │  (Kanban/    │  │     View     │  │  Dashboard   │  │
│  │   Table)     │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│              TanStack Query (State Layer)                │
│  - Caching, Real-time sync, Optimistic updates         │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Supabase Backend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │   Storage    │  │   Realtime   │  │
│  │   Database   │  │   (Files)    │  │ (Websockets) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Edge         │  │   Email      │                    │
│  │ Functions    │  │ Notifications│                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18.3.1 + TypeScript
- TanStack Query 5.83.0 for data fetching
- React Hook Form 7.61.1 + Zod 3.25.76 for forms
- Framer Motion 12.34.3 for animations
- shadcn/ui component library (Radix UI primitives)
- React Router DOM 6.30.1 for navigation

**Backend:**
- Supabase (PostgreSQL + Edge Functions + Storage + Realtime)
- Row Level Security (RLS) for access control
- Triggers for audit logging and real-time updates

**File Storage:**
- Supabase Storage with public/private buckets
- Supported formats: Images (jpg, png, gif, webp), PDFs, Documents (doc, docx, xls, xlsx), Archives (zip)
- Max file size: 10MB

**Notifications:**
- Supabase Edge Functions for email delivery
- In-app notifications via React Query + Realtime subscriptions

## Database Schema

### New Tables

#### `issue_comments`
Stores threaded comments on issues.

```sql
CREATE TABLE public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.issue_comments(id) ON DELETE CASCADE,
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_issue_comments_issue_id ON public.issue_comments(issue_id);
CREATE INDEX idx_issue_comments_parent_id ON public.issue_comments(parent_id);
CREATE INDEX idx_issue_comments_user_id ON public.issue_comments(user_id);
```

#### `issue_attachments`
Stores file attachments linked to issues.

```sql
CREATE TABLE public.issue_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_issue_attachments_issue_id ON public.issue_attachments(issue_id);
```

#### `issue_activity`
Audit log of all issue changes for activity timeline.

```sql
CREATE TYPE issue_activity_type AS ENUM (
  'created', 'status_changed', 'priority_changed', 'assigned', 'unassigned',
  'vendor_changed', 'due_date_changed', 'title_changed', 'description_changed',
  'comment_added', 'attachment_added', 'attachment_deleted', 'label_added',
  'label_removed', 'time_logged', 'relationship_added', 'relationship_removed',
  'estimate_changed'
);

CREATE TABLE public.issue_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type issue_activity_type NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_issue_activity_issue_id ON public.issue_activity(issue_id);
CREATE INDEX idx_issue_activity_created_at ON public.issue_activity(created_at DESC);
```

#### `issue_labels`
Master table for system-wide issue labels.

```sql
CREATE TABLE public.issue_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### `issue_label_relations`
Many-to-many relationship between issues and labels.

```sql
CREATE TABLE public.issue_label_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.issue_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, label_id)
);

CREATE INDEX idx_issue_label_relations_issue_id ON public.issue_label_relations(issue_id);
CREATE INDEX idx_issue_label_relations_label_id ON public.issue_label_relations(label_id);
```

#### `issue_time_logs`
Time tracking entries for issues.

```sql
CREATE TABLE public.issue_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours DECIMAL(6, 2) NOT NULL CHECK (hours > 0),
  description TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_issue_time_logs_issue_id ON public.issue_time_logs(issue_id);
CREATE INDEX idx_issue_time_logs_user_id ON public.issue_time_logs(user_id);
```

#### `issue_relationships`
Links between related issues (blocks, depends on, duplicates, etc.).

```sql
CREATE TYPE issue_relationship_type AS ENUM (
  'blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by'
);

CREATE TABLE public.issue_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  related_issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  relationship_type issue_relationship_type NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, related_issue_id, relationship_type),
  CHECK (issue_id != related_issue_id)
);

CREATE INDEX idx_issue_relationships_issue_id ON public.issue_relationships(issue_id);
CREATE INDEX idx_issue_relationships_related_issue_id ON public.issue_relationships(related_issue_id);
```

#### `issue_templates`
Predefined templates for common issue types.

```sql
CREATE TABLE public.issue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  title_template TEXT NOT NULL,
  description_template TEXT,
  default_priority issue_priority DEFAULT 'medium',
  category TEXT,
  default_labels UUID[],
  created_by UUID REFERENCES auth.users(id),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### `issue_watchers`
Tracks which users are watching specific issues for notifications.

```sql
CREATE TABLE public.issue_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX idx_issue_watchers_issue_id ON public.issue_watchers(issue_id);
CREATE INDEX idx_issue_watchers_user_id ON public.issue_watchers(user_id);
```

#### `saved_issue_filters`
User-created saved filter views.

```sql
CREATE TABLE public.saved_issue_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_issue_filters_user_id ON public.saved_issue_filters(user_id);
```

#### `issue_sla_config`
SLA configuration per priority level.

```sql
CREATE TABLE public.issue_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority issue_priority NOT NULL UNIQUE,
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Modified Tables

#### `issues` (Enhancements)
Add new columns to existing `issues` table:

```sql
ALTER TABLE public.issues
  ADD COLUMN estimated_hours DECIMAL(6, 2),
  ADD COLUMN first_response_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN sla_response_breached BOOLEAN DEFAULT false,
  ADD COLUMN sla_resolution_breached BOOLEAN DEFAULT false;

-- Add computed column for actual hours (sum of time logs)
-- This will be a view rather than column to keep data normalized
```

### Database Functions & Triggers

#### Auto-track first response time
```sql
CREATE OR REPLACE FUNCTION track_first_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Update first_response_at when first comment is added
  IF (SELECT first_response_at FROM issues WHERE id = NEW.issue_id) IS NULL THEN
    UPDATE issues
    SET first_response_at = NOW()
    WHERE id = NEW.issue_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_first_response
  AFTER INSERT ON issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION track_first_response();
```

#### Auto-log activity
```sql
CREATE OR REPLACE FUNCTION log_issue_activity()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO issue_activity (issue_id, user_id, activity_type, new_value)
    VALUES (NEW.id, _user_id, 'created', NEW.title);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO issue_activity (issue_id, user_id, activity_type, old_value, new_value)
      VALUES (NEW.id, _user_id, 'status_changed', OLD.status, NEW.status);
    END IF;
    IF OLD.priority != NEW.priority THEN
      INSERT INTO issue_activity (issue_id, user_id, activity_type, old_value, new_value)
      VALUES (NEW.id, _user_id, 'priority_changed', OLD.priority, NEW.priority);
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      IF NEW.assigned_to IS NULL THEN
        INSERT INTO issue_activity (issue_id, user_id, activity_type, old_value)
        VALUES (NEW.id, _user_id, 'unassigned', OLD.assigned_to::text);
      ELSE
        INSERT INTO issue_activity (issue_id, user_id, activity_type, new_value)
        VALUES (NEW.id, _user_id, 'assigned', NEW.assigned_to::text);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_issue_activity
  AFTER INSERT OR UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION log_issue_activity();
```

#### Auto-watch on assignment/comment
```sql
CREATE OR REPLACE FUNCTION auto_watch_issue()
RETURNS TRIGGER AS $$
BEGIN
  -- Add watcher when user is assigned
  IF TG_TABLE_NAME = 'issues' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO issue_watchers (issue_id, user_id)
    VALUES (NEW.id, NEW.assigned_to)
    ON CONFLICT (issue_id, user_id) DO NOTHING;
  END IF;
  
  -- Add watcher when user comments
  IF TG_TABLE_NAME = 'issue_comments' THEN
    INSERT INTO issue_watchers (issue_id, user_id)
    VALUES (NEW.issue_id, NEW.user_id)
    ON CONFLICT (issue_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_watch_on_assign
  AFTER INSERT OR UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_watch_issue();

CREATE TRIGGER trigger_auto_watch_on_comment
  AFTER INSERT ON issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION auto_watch_issue();
```

#### Check SLA breaches
```sql
CREATE OR REPLACE FUNCTION check_sla_breach()
RETURNS TRIGGER AS $$
DECLARE
  _sla_config RECORD;
  _response_deadline TIMESTAMP WITH TIME ZONE;
  _resolution_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get SLA config for this priority
  SELECT * INTO _sla_config
  FROM issue_sla_config
  WHERE priority = NEW.priority;
  
  IF FOUND THEN
    _response_deadline := NEW.created_at + (_sla_config.response_time_minutes || ' minutes')::INTERVAL;
    _resolution_deadline := NEW.created_at + (_sla_config.resolution_time_minutes || ' minutes')::INTERVAL;
    
    -- Check response SLA
    IF NEW.first_response_at IS NULL AND NOW() > _response_deadline THEN
      NEW.sla_response_breached := true;
    END IF;
    
    -- Check resolution SLA
    IF NEW.status NOT IN ('resolved', 'closed') AND NOW() > _resolution_deadline THEN
      NEW.sla_resolution_breached := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_sla_breach
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION check_sla_breach();
```

### Row Level Security (RLS) Policies

#### `issue_comments` policies
```sql
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments on issues they can see
CREATE POLICY "Users can view comments on accessible issues" ON public.issue_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE id = issue_id
    )
  );

-- Users can create comments on any issue
CREATE POLICY "Users can create comments" ON public.issue_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments (for edits)
CREATE POLICY "Users can update own comments" ON public.issue_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can soft-delete their own comments, admins can delete any
CREATE POLICY "Users can delete own comments" ON public.issue_comments
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role)
  );
```

#### `issue_attachments` policies
```sql
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments on accessible issues" ON public.issue_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE id = issue_id
    )
  );

CREATE POLICY "Users can upload attachments" ON public.issue_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attachments" ON public.issue_attachments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role)
  );
```

#### Other table policies (similar pattern)
- `issue_activity`: Read-only for users, auto-populated by triggers
- `issue_labels`: Read all, write admin-only
- `issue_label_relations`: Users can modify labels on issues they access
- `issue_time_logs`: Users can log time on issues, view all logs
- `issue_relationships`: Users can create relationships, admins can delete
- `issue_templates`: Read all, write admin-only
- `issue_watchers`: Users can watch/unwatch issues
- `saved_issue_filters`: Users manage own filters, read shared filters
- `issue_sla_config`: Read all, write admin-only

## Component Architecture

### Page Components

#### `IssueDetail.tsx` (New)
Full-page detailed view of a single issue.

**Route:** `/issues/:id`

**Props:**
```typescript
interface IssueDetailProps {
  // Issue ID from route params
}
```

**State:**
- `issue`: Full issue data including relations
- `comments`: Paginated comments list
- `activity`: Activity timeline with filters
- `attachments`: List of file attachments
- `timeLog s`: Time tracking entries
- `relationships`: Related issues
- `watchers`: Users watching this issue
- `editingField`: Currently inline-editing field
- `activeTab`: Active section (overview, activity, time tracking)

**Sections:**
1. **Header**: Title, status, priority, quick actions (watch, AI assist, export)
2. **Sidebar**: Metadata (assignee, reporter, vendor, dates, labels, SLA status, estimated/actual hours)
3. **Main Content**: Tabbed interface
   - **Overview Tab**: Description, attachments, relationships
   - **Activity Tab**: Comments and timeline with filter options
   - **Time Tracking Tab**: Time logs with total/estimated hours

**Key Behaviors:**
- Real-time updates via Supabase subscriptions
- Inline editing of title, description, metadata fields
- Keyboard shortcuts (E to edit, C to comment, Esc to close)
- Optimistic updates for instant UI feedback

### Feature Components

#### `IssueComments.tsx` (New)
Comment list and input for issue discussions.

**Props:**
```typescript
interface IssueCommentsProps {
  issueId: string;
  comments: IssueComment[];
  onCommentAdded: (comment: IssueComment) => void;
}
```

**Features:**
- Rich text input with @ mentions autocomplete
- Edit/delete actions for comment authors
- Staggered animation for comment list
- Inline replies (threaded comments via `parent_id`)
- "edited" indicator for modified comments

**Animation:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.2 }}
>
  {/* Comment content */}
</motion.div>
```

#### `IssueActivityTimeline.tsx` (New)
Chronological timeline of all issue changes.

**Props:**
```typescript
interface IssueActivityTimelineProps {
  issueId: string;
  activities: IssueActivity[];
  filterType?: 'all' | 'comments' | 'changes';
}
```

**Activity Types Rendered:**
- `created`: "User created this issue"
- `status_changed`: "User changed status from X to Y"
- `assigned`: "User assigned this issue to Z"
- `comment_added`: Shows comment content inline
- `attachment_added`: "User attached filename.ext"
- `label_added/removed`: "User added/removed label X"
- `time_logged`: "User logged X hours"

**Visual Patterns:**
- Icon per activity type (using Lucide icons)
- Color-coded based on activity type
- Relative timestamps ("2 hours ago")
- Expandable details for complex activities

#### `IssueAttachments.tsx` (New)
File upload and attachment viewer.

**Props:**
```typescript
interface IssueAttachmentsProps {
  issueId: string;
  attachments: IssueAttachment[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}
```

**Features:**
- Drag-and-drop zone with visual feedback
- File type validation (images, PDFs, docs, archives)
- Size validation (max 10MB)
- Progress indicators during upload
- Thumbnail generation for images
- Lightbox viewer for image galleries
- PDF preview in modal

**Upload Flow:**
1. User drags files or clicks to select
2. Validate file types and sizes
3. Upload to Supabase Storage (`issue-attachments/` bucket)
4. Store metadata in `issue_attachments` table
5. Log activity in timeline
6. Show success toast

**Styling:**
```tsx
<div className="border-2 border-dashed border-border rounded-lg p-8 
                text-center hover:border-primary hover:bg-accent/5 
                transition-colors cursor-pointer group">
  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground 
                     group-hover:text-primary transition-colors" />
  <p className="text-sm text-muted-foreground">
    Drag files here or click to browse
  </p>
</div>
```

#### `IssueLabels.tsx` (New)
Label picker and badge display.

**Props:**
```typescript
interface IssueLabelsProps {
  issueId: string;
  selectedLabels: IssueLabel[];
  allLabels: IssueLabel[];
  onAdd: (labelId: string) => void;
  onRemove: (labelId: string) => void;
  onCreateNew: (name: string, color: string) => void;
}
```

**Features:**
- Badge display with label colors
- Dropdown picker using shadcn Command component
- Search/filter labels by name
- Quick create new label inline
- Color picker with preset color palette

**Label Badge Component:**
```tsx
<Badge 
  className="gap-1.5 pr-1" 
  style={{ 
    backgroundColor: `${label.color}15`,
    color: label.color,
    borderColor: `${label.color}30`
  }}
>
  {label.name}
  <X 
    className="w-3 h-3 cursor-pointer hover:scale-110 transition-transform" 
    onClick={() => onRemove(label.id)}
  />
</Badge>
```

#### `IssueTimeTracking.tsx` (New)
Time logging and estimation interface.

**Props:**
```typescript
interface IssueTimeTrackingProps {
  issueId: string;
  estimatedHours?: number;
  timeLogs: IssueTimeLog[];
  onLogTime: (hours: number, description: string) => void;
  onUpdateEstimate: (hours: number) => void;
}
```

**Display:**
- Progress bar showing actual vs estimated hours
- List of time log entries with user, date, hours, description
- Total hours calculated from all logs
- "Log time" button opening dialog

**Time Log Dialog:**
- Number input for hours (decimal support: 0.5, 1.5, etc.)
- Textarea for optional description
- Preset buttons (0.5h, 1h, 2h, 4h, 8h)

#### `IssueSLAStatus.tsx` (New)
SLA compliance indicator.

**Props:**
```typescript
interface IssueSLAStatusProps {
  issue: Issue;
  slaConfig: SLAConfig;
}
```

**Display:**
- Response time status (met, approaching, breached)
- Resolution time status (met, approaching, breached)
- Countdown timer for approaching deadlines
- Visual indicator colors (green, yellow, red)

**Status Calculation:**
```typescript
const getResponseStatus = (issue: Issue, config: SLAConfig) => {
  if (issue.first_response_at) return 'met';
  const deadline = addMinutes(issue.created_at, config.response_time_minutes);
  const remaining = differenceInMinutes(deadline, new Date());
  if (remaining <= 0) return 'breached';
  if (remaining <= config.response_time_minutes * 0.2) return 'approaching';
  return 'on_track';
};
```

#### `IssueRelationships.tsx` (New)
Related issues display and linking.

**Props:**
```typescript
interface IssueRelationshipsProps {
  issueId: string;
  relationships: IssueRelationship[];
  onAdd: (relatedIssueId: string, type: RelationshipType) => void;
  onRemove: (relationshipId: string) => void;
}
```

**Relationship Types:**
- Blocks / Blocked by (bidirectional)
- Relates to
- Duplicates / Duplicated by

**Add Relationship Dialog:**
1. Select relationship type
2. Search issues by title (Command component)
3. Preview selected issue
4. Confirm to create bidirectional link

#### `IssueBulkActions.tsx` (New)
Bulk operation toolbar.

**Props:**
```typescript
interface IssueBulkActionsProps {
  selectedIssues: string[];
  onAssign: (userId: string) => Promise<void>;
  onStatusChange: (status: IssueStatus) => Promise<void>;
  onPriorityChange: (priority: IssuePriority) => Promise<void>;
  onAddLabel: (labelId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClearSelection: () => void;
}
```

**Display:**
- Fixed position toolbar at bottom of screen when items selected
- Selection count badge
- Action buttons (Assign, Priority, Status, Labels, Delete)
- Progress indicator during bulk operation
- Error summary if some operations fail

**Animation:**
```tsx
<motion.div
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: 100, opacity: 0 }}
  className="fixed bottom-6 left-1/2 -translate-x-1/2 
             bg-background border border-border rounded-lg shadow-lg p-4"
>
  {/* Bulk actions content */}
</motion.div>
```

#### `IssueFilters.tsx` (Enhanced)
Advanced filter panel with save functionality.

**Props:**
```typescript
interface IssueFiltersProps {
  filters: IssueFilters;
  onFilterChange: (filters: IssueFilters) => void;
  savedViews: SavedFilter[];
  onSaveView: (name: string) => void;
  onLoadView: (viewId: string) => void;
}

interface IssueFilters {
  priorities?: IssuePriority[];
  statuses?: IssueStatus[];
  assignees?: string[];
  reporters?: string[];
  vendors?: string[];
  labels?: string[];
  dueDateRange?: { start: Date; end: Date };
  createdDateRange?: { start: Date; end: Date };
  slaBreached?: boolean;
  unassigned?: boolean;
}
```

**Features:**
- Sheet component for filter panel (slides in from right)
- Multi-select for each filter type
- Date range pickers using shadcn Calendar
- "Save as view" button
- "System views" and "My views" sections
- Active filter badges with clear button

#### `IssueTemplateSelector.tsx` (New)
Template picker for new issue creation.

**Props:**
```typescript
interface IssueTemplateSelectorProps {
  templates: IssueTemplate[];
  onSelect: (template: IssueTemplate) => void;
  onCancel: () => void;
}
```

**Display:**
- Grid of template cards grouped by category
- Each card shows template name, description, default priority
- Search/filter templates
- "Blank issue" option at top

#### `IssueExport.tsx` (New)
Export functionality for issues.

**Features:**
- Export current filtered view to CSV
- Export single issue detail to PDF
- Export summary report to PDF
- Configuration options (include comments, include activity, date range)

**CSV Export Columns:**
ID, Title, Description, Priority, Status, Assignee, Reporter, Vendor, Labels, Created Date, Due Date, Resolved Date, Estimated Hours, Actual Hours, SLA Status

**PDF Export (using jspdf + jspdf-autotable):**
- Header with issue ID and title
- Metadata table
- Description section
- Comments section (optional)
- Activity timeline (optional)
- Attachments list

### Custom Hooks

#### `useIssueDetail.ts`
```typescript
export function useIssueDetail(issueId: string) {
  return useQuery({
    queryKey: ['issues', issueId, 'detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          vendor:vendors(id, name),
          reporter:profiles!reported_by(id, full_name, email),
          assignee:profiles!assigned_to(id, full_name, email),
          labels:issue_label_relations(
            label:issue_labels(*)
          ),
          comments:issue_comments(
            *,
            user:profiles(id, full_name, avatar_url)
          ),
          attachments:issue_attachments(*),
          time_logs:issue_time_logs(
            *,
            user:profiles(id, full_name)
          ),
          relationships:issue_relationships(
            *,
            related_issue:issues(id, title, status, priority)
          ),
          activity:issue_activity(
            *,
            user:profiles(id, full_name)
          )
        `)
        .eq('id', issueId)
        .single();
      
      if (error) throw error;
      return data as IssueDetail;
    },
  });
}
```

#### `useIssueComments.ts`
```typescript
export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueId, content, parentId }: CreateCommentInput) => {
      const { data, error } = await supabase
        .from('issue_comments')
        .insert({
          issue_id: issueId,
          user_id: (await supabase.auth.getUser()).data.user!.id,
          content,
          parent_id: parentId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.issue_id] });
      toast.success('Comment added');
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from('issue_comments')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.issue_id] });
      toast.success('Comment updated');
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { data, error } = await supabase
        .from('issue_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.issue_id] });
      toast.success('Comment deleted');
    },
  });
}
```

#### `useIssueAttachments.ts`
```typescript
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueId, file }: { issueId: string; file: File }) => {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${issueId}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('issue-attachments')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('issue-attachments')
        .getPublicUrl(fileName);
      
      // 3. Save metadata
      const { data, error } = await supabase
        .from('issue_attachments')
        .insert({
          issue_id: issueId,
          user_id: (await supabase.auth.getUser()).data.user!.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          storage_path: fileName,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.issue_id] });
      toast.success('File uploaded');
    },
  });
}
```

#### `useIssueLabels.ts`
```typescript
export function useIssueLabels() {
  return useQuery({
    queryKey: ['issue-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_labels')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as IssueLabel[];
    },
  });
}

export function useAddLabelToIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueId, labelId }: { issueId: string; labelId: string }) => {
      const { data, error } = await supabase
        .from('issue_label_relations')
        .insert({ issue_id: issueId, label_id: labelId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issues', variables.issueId] });
    },
  });
}
```

#### `useIssueTimeTracking.ts`
```typescript
export function useLogTime() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueId, hours, description }: LogTimeInput) => {
      const { data, error } = await supabase
        .from('issue_time_logs')
        .insert({
          issue_id: issueId,
          user_id: (await supabase.auth.getUser()).data.user!.id,
          hours,
          description,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.issue_id] });
      toast.success(`Logged ${data.hours} hours`);
    },
  });
}
```

#### `useIssueBulkOperations.ts`
```typescript
export function useBulkUpdateIssues() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueIds, updates }: { 
      issueIds: string[]; 
      updates: Partial<Issue> 
    }) => {
      const results = await Promise.allSettled(
        issueIds.map(id => 
          supabase
            .from('issues')
            .update(updates)
            .eq('id', id)
        )
      );
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return { succeeded, failed, total: issueIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      if (result.failed === 0) {
        toast.success(`Updated ${result.succeeded} issues`);
      } else {
        toast.warning(
          `Updated ${result.succeeded} of ${result.total} issues. ${result.failed} failed.`
        );
      }
    },
  });
}
```

#### `useSavedFilters.ts`
```typescript
export function useSavedFilters() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['saved-filters', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_issue_filters')
        .select('*')
        .or(`user_id.eq.${user!.id},is_shared.eq.true`)
        .order('name');
      
      if (error) throw error;
      return data as SavedFilter[];
    },
  });
}

export function useSaveFilter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ name, filters, isShared }: SaveFilterInput) => {
      const { data, error } = await supabase
        .from('saved_issue_filters')
        .insert({
          user_id: user!.id,
          name,
          filters,
          is_shared: isShared,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filter saved');
    },
  });
}
```

### Email Notification System

#### Edge Function: `send-issue-notification`
Location: `supabase/functions/send-issue-notification/index.ts`

**Triggers:**
- Issue assigned (notify assignee)
- Issue commented (notify watchers)
- User mentioned in comment (notify mentioned user)
- Issue status changed (notify watchers)
- SLA breached (notify assignee and admins)

**Implementation:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { event, issueId, recipientId, data } = await req.json();
  
  // Initialize Supabase client with service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Fetch recipient email and notification preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, notification_preferences')
    .eq('id', recipientId)
    .single();
  
  // Check if user wants email notifications for this event type
  if (!profile?.notification_preferences?.[event]) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }
  
  // Fetch issue details
  const { data: issue } = await supabase
    .from('issues')
    .select('id, title, priority, status')
    .eq('id', issueId)
    .single();
  
  // Send email via your email service (e.g., SendGrid, Resend, AWS SES)
  const emailHtml = generateEmailTemplate(event, issue, data);
  
  // For demo, using fetch to an email API
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'notifications@lazeez-vorp.com',
      to: profile.email,
      subject: `[Issue #${issue.id}] ${getSubjectForEvent(event, issue)}`,
      html: emailHtml,
    }),
  });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

#### Database Trigger for Notifications
```sql
CREATE OR REPLACE FUNCTION notify_issue_watchers()
RETURNS TRIGGER AS $$
DECLARE
  _watcher RECORD;
BEGIN
  -- On comment added, notify all watchers except commenter
  IF TG_TABLE_NAME = 'issue_comments' THEN
    FOR _watcher IN 
      SELECT user_id FROM issue_watchers 
      WHERE issue_id = NEW.issue_id AND user_id != NEW.user_id
    LOOP
      PERFORM net.http_post(
        url := 'https://your-project.supabase.co/functions/v1/send-issue-notification',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('request.jwt.claims')::json->>'sub'),
        body := jsonb_build_object(
          'event', 'comment_added',
          'issueId', NEW.issue_id,
          'recipientId', _watcher.user_id,
          'data', jsonb_build_object('commenterId', NEW.user_id)
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_watchers_on_comment
  AFTER INSERT ON issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_issue_watchers();
```

## API Design

### REST-ful Endpoints (via Supabase PostgREST)

All endpoints are automatically generated by Supabase PostgREST based on database schema and RLS policies.

**Base URL:** `https://your-project.supabase.co/rest/v1/`

#### Issues
- `GET /issues` - List all issues (with filters via query params)
- `GET /issues?id=eq.{id}&select=*,comments(*)` - Get single issue with relations
- `POST /issues` - Create new issue
- `PATCH /issues?id=eq.{id}` - Update issue
- `DELETE /issues?id=eq.{id}` - Delete issue

**Query Examples:**
```typescript
// List issues with filters
const { data } = await supabase
  .from('issues')
  .select('*, vendor:vendors(name)')
  .eq('status', 'open')
  .in('priority', ['high', 'critical'])
  .order('created_at', { ascending: false });

// Get issue detail with all relations
const { data } = await supabase
  .from('issues')
  .select(`
    *,
    vendor:vendors(id, name),
    comments:issue_comments(*),
    labels:issue_label_relations(label:issue_labels(*))
  `)
  .eq('id', issueId)
  .single();
```

#### Comments
- `GET /issue_comments?issue_id=eq.{issueId}` - List comments for issue
- `POST /issue_comments` - Create comment
- `PATCH /issue_comments?id=eq.{id}` - Update comment
- `DELETE /issue_comments?id=eq.{id}` - Soft delete comment

#### Attachments
- `GET /issue_attachments?issue_id=eq.{issueId}` - List attachments
- `POST /issue_attachments` - Create attachment metadata (after Storage upload)
- `DELETE /issue_attachments?id=eq.{id}` - Delete attachment

#### Labels
- `GET /issue_labels` - List all labels
- `POST /issue_labels` - Create label (admin only)
- `PATCH /issue_labels?id=eq.{id}` - Update label
- `DELETE /issue_labels?id=eq.{id}` - Delete label

#### Label Relations
- `POST /issue_label_relations` - Add label to issue
- `DELETE /issue_label_relations?issue_id=eq.{issueId}&label_id=eq.{labelId}` - Remove label

#### Time Logs
- `GET /issue_time_logs?issue_id=eq.{issueId}` - List time logs
- `POST /issue_time_logs` - Log time

#### Relationships
- `POST /issue_relationships` - Create relationship
- `DELETE /issue_relationships?id=eq.{id}` - Remove relationship

#### Templates
- `GET /issue_templates` - List templates
- `POST /issue_templates` - Create template (admin)
- `PATCH /issue_templates?id=eq.{id}` - Update template
- `DELETE /issue_templates?id=eq.{id}` - Delete template

#### Saved Filters
- `GET /saved_issue_filters` - List user's and shared filters
- `POST /saved_issue_filters` - Save filter
- `DELETE /saved_issue_filters?id=eq.{id}` - Delete filter

### Real-time Subscriptions

#### Subscribe to issue changes
```typescript
const channel = supabase
  .channel(`issue-${issueId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'issues',
      filter: `id=eq.${issueId}`,
    },
    (payload) => {
      // Update UI with new data
      queryClient.setQueryData(['issues', issueId], payload.new);
    }
  )
  .subscribe();
```

#### Subscribe to new comments
```typescript
const channel = supabase
  .channel(`issue-comments-${issueId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'issue_comments',
      filter: `issue_id=eq.${issueId}`,
    },
    (payload) => {
      // Add new comment to list
      queryClient.invalidateQueries(['issues', issueId, 'comments']);
    }
  )
  .subscribe();
```

## UI/UX Design Patterns

### Design System Compliance

All components MUST adhere to existing design system:

**Typography:**
- Page title: `font-bold text-2xl` (Montserrat)
- Section headers: `font-semibold text-lg` (Poppins)
- Body text: `font-normal text-sm` (Poppins)
- Labels: `font-medium text-sm text-muted-foreground`
- NO ALL CAPS except for severity badges (CRITICAL, HIGH)

**Colors:**
- Priority colors: Use existing `--priority-low`, `--priority-medium`, `--priority-high`, `--priority-critical`
- Status colors: Use existing `--success`, `--warning`, `--info`, `--destructive`
- SLA status:
  - On track: `text-success`
  - Approaching: `text-warning`
  - Breached: `text-destructive`

**Animations:**
All animations use Framer Motion with existing timing standards:
- Micro-interactions: 150-200ms
- Entry animations: 300-400ms
- Stagger delay: 50-80ms

**Example - Issue Detail View Header:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  className="flex items-start justify-between mb-6"
>
  <div className="flex-1">
    <motion.h1 
      className="font-bold text-2xl text-foreground mb-2"
      whileHover={{ scale: 1.01 }}
    >
      {issue.title}
    </motion.h1>
    <div className="flex items-center gap-2">
      <Badge className={priorityConfig[issue.priority].color}>
        {issue.priority.toUpperCase()}
      </Badge>
      <Badge className={statusConfig[issue.status].color}>
        {statusLabels[issue.status]}
      </Badge>
    </div>
  </div>
  
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm">
      <Eye className="w-4 h-4 mr-2" />
      Watch
    </Button>
    <Button variant="outline" size="sm">
      <Brain className="w-4 h-4 mr-2" />
      AI Assist
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <FileDown className="w-4 h-4 mr-2" />
          Export to PDF
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link className="w-4 h-4 mr-2" />
          Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</motion.div>
```

### Keyboard Shortcuts Map

| Shortcut | Action | Context |
|----------|--------|---------|
| `?` | Open shortcuts help | Global |
| `N` | New issue | Issues page |
| `K` or `Cmd/Ctrl+K` | Open command palette | Global |
| `Esc` | Close modal/detail view | Modal/detail open |
| `↑/↓` | Navigate issue list | Issues page |
| `Enter` | Open selected issue | Issue selected |
| `E` | Edit mode | Issue detail |
| `C` | Focus comment input | Issue detail |
| `A` | Assign issue | Issue detail |
| `L` | Add label | Issue detail |
| `P` | Change priority | Issue detail |
| `S` | Change status | Issue detail |
| `R` | Refresh view | Issues page |
| `Cmd/Ctrl+Enter` | Submit form/comment | Form active |

### Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile adaptations:**
- Issue detail view: Full-screen modal instead of side sheet
- Kanban: Horizontal scroll with snap points
- Bulk actions toolbar: Slide up from bottom
- Filters: Full-screen sheet
- Comments: Simplified layout, avatars smaller

**Tablet adaptations:**
- Issue detail: 60% width sheet
- Kanban: 2 columns visible at once
- Sidebar metadata: Collapsible

## Performance Optimization

### Data Fetching Strategy

1. **Initial page load:** Fetch issues list with basic fields only
2. **Issue detail:** Lazy load comments, activity, attachments on demand
3. **Infinite scroll:** Load 50 issues at a time, paginate with cursor
4. **Debounced search:** 300ms delay before triggering search query
5. **Optimistic updates:** Immediate UI feedback for mutations

### Caching Strategy

```typescript
// TanStack Query cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

### Image Optimization

- Thumbnails generated at 200x200px for attachments
- Progressive loading with skeleton placeholders
- Lazy load images below fold
- Use WebP format with fallbacks

### Bundle Size Optimization

- Code split by route (React.lazy)
- Lazy load heavy components (PDF viewer, dependency graph)
- Tree-shake unused Lucide icons
- Compress assets in production build

## Security Considerations

### File Upload Security

1. **Validation:**
   - File type whitelist (images, PDFs, docs only)
   - Max size limit enforced client and server-side (10MB)
   - Scan for malware (future: integrate ClamAV)

2. **Storage:**
   - UUID-based file paths prevent enumeration
   - Separate bucket for attachments with RLS policies
   - Pre-signed URLs for private files

3. **Access Control:**
   - Only authenticated users can upload
   - RLS ensures users can only access attachments on issues they can view

### XSS Protection

- All user-generated content sanitized before rendering
- Comments support Markdown but HTML is escaped
- Use DOMPurify for sanitization if rich text added

### Rate Limiting

- Implement rate limiting on Edge Functions (100 requests/minute per user)
- Throttle real-time subscriptions (max 10 channels per connection)
- Bulk operations limited to 100 issues at once

### Audit Logging

- All mutations logged in `issue_activity` table
- Soft deletes for comments (retain audit trail)
- Track user, timestamp, old/new values for all changes

## Testing Strategy

### Unit Tests

- Custom hooks (useIssueDetail, useCreateComment, etc.)
- Utility functions (SLA calculation, filter logic)
- Component helpers (formatRelativeTime, parseMentions)

**Framework:** Vitest + React Testing Library

### Integration Tests

- Issue CRUD operations
- Comment threading
- File upload flow
- Bulk operations
- Filter and search

**Framework:** Playwright

### E2E Tests

Critical user journeys:
1. Create issue → Add comment → Upload attachment → Resolve
2. Assign issue → Receive notification → Update status
3. Apply filters → Save view → Export to CSV
4. Bulk select issues → Change priority → Verify updates

**Framework:** Playwright with Supabase test database

## Migration Strategy

### Phase 1: Database Migration
1. Run migration to create new tables
2. Seed default SLA config, labels, templates
3. Verify RLS policies
4. Test triggers and functions

### Phase 2: Feature Rollout
1. Deploy issue detail view (read-only)
2. Enable comments
3. Enable attachments
4. Enable time tracking and SLA
5. Enable advanced features (bulk ops, templates, relationships)

### Phase 3: Data Migration
1. Backfill `first_response_at` for existing issues
2. Generate initial activity timeline for existing issues
3. Auto-assign watchers for assigned issues

### Rollback Plan
- Feature flags for each epic
- Database migrations are reversible
- Can disable real-time subscriptions if performance issues

## Future Enhancements (Out of Scope)

- Integration with external systems (Jira, Slack)
- Advanced workflow automation (rules engine)
- Custom fields per issue type
- Issue voting and public portal
- Mobile native apps
- AI-powered auto-triage and assignment
- Video/audio attachments
- Real-time collaborative editing
