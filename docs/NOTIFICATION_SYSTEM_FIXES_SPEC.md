# Notification System Fixes & Enhancements Specification

**Version**: 4.0  
**Date**: March 18, 2026  
**Status**: 🔄 In Progress

---

## Overview

Comprehensive specification for fixing and enhancing the notification system with:
1. Restore old category cards (horizontal scrollable)
2. Audit and fix real-time notifications
3. Add continuous tick animation with glow
4. Implement Archive feature
5. Fix diagnostic panel layout (horizontal)
6. Fix issue/MOU creation panels (horizontal)

---

## 1. Restore Old Category Cards

### Current State
- Expandable category rows with "Show more" button
- Vertical layout

### Required State
- Horizontal scrollable category cards strip
- Keep expandable rows below
- Both views should coexist

### Implementation Plan

**Component**: `src/components/pages/Notifications.tsx`

```typescript
// Add horizontal category strip at top
<div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
  {Object.entries(categoryCounts).map(([category, data]) => (
    <Card className="flex-shrink-0 w-40 cursor-pointer hover:shadow-lg">
      <CardContent className="p-4">
        <Icon className="w-5 h-5 mb-2" />
        <p className="text-lg font-bold">{data.total}</p>
        <p className="text-xs text-muted-foreground">{categoryLabels[category]}</p>
        {data.unread > 0 && (
          <Badge className="mt-2">{data.unread} unread</Badge>
        )}
      </CardContent>
    </Card>
  ))}
</div>

// Keep expandable rows below
<div className="space-y-3 mt-6">
  {/* Existing expandable category rows */}
</div>
```

---

## 2. Real-Time Notification Audit & Fix

### Issues to Investigate

1. **Toast Notifications**
   - Are they showing for all user actions?
   - Do they include user name and avatar?
   - Are they working with the notification bell?

2. **Real-Time Subscriptions**
   - Check Supabase real-time channels
   - Verify all tables are being watched
   - Ensure proper filtering

3. **Notification Creation**
   - Audit logs should trigger notifications
   - User actions should create notifications
   - Notifications should include metadata (avatar_url, user_name)

### Current Implementation Analysis

**File**: `src/hooks/useNotifications.ts`

**Real-time subscriptions**:
```typescript
const channel = supabase
  .channel('unified-notifications-sync')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_notifications' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'mous' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_payments' }, ...)
  .subscribe();
```

### Required Enhancements

1. **Add notification creation triggers**
   - Create database triggers for all major actions
   - Insert into `notifications` table with user metadata

2. **Enhance toast notifications**
   - Show user avatar in toast
   - Include user name
   - Add action buttons (View, Dismiss)

3. **Create notifications table** (if not exists)
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  type VARCHAR(20) NOT NULL, -- info, success, warning, error
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  action_url VARCHAR(255),
  read BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
```

4. **Create database triggers**
```sql
-- Example: Trigger on issue creation
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    category,
    title,
    message,
    entity_type,
    entity_id,
    action_url,
    created_by,
    metadata
  )
  SELECT 
    NEW.assigned_to,
    'info',
    'issue',
    (SELECT full_name FROM profiles WHERE id = NEW.created_by) || ' assigned an Issue',
    NEW.title,
    'issue',
    NEW.id,
    '/issues',
    NEW.created_by,
    jsonb_build_object(
      'avatar_url', (SELECT avatar_url FROM profiles WHERE id = NEW.created_by),
      'priority', NEW.priority
    )
  WHERE NEW.assigned_to IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issue_created_notification
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_issue_created();
```

---

## 3. Continuous Tick Animation with Glow

### Current State
- Static CheckCheck icon in empty state
- Basic animation on mount

### Required State
- Continuous tick animation (repeating)
- Subtle glow effect
- Smooth, professional animation

### Implementation

**Component**: `src/components/pages/Notifications.tsx`

```typescript
// Empty state with continuous tick animation
<motion.div
  className="relative w-24 h-24 bg-card border border-emerald-500/20 rounded-[40px] flex items-center justify-center shadow-2xl mb-8"
>
  {/* Glow effect */}
  <motion.div
    className="absolute inset-0 rounded-[40px] bg-emerald-500/20"
    animate={{
      opacity: [0.3, 0.6, 0.3],
      scale: [1, 1.05, 1],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />
  
  {/* Tick icon */}
  <motion.div
    animate={{ 
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0],
    }}
    transition={{ 
      duration: 1.5,
      repeat: Infinity,
      repeatDelay: 1,
      ease: "easeInOut"
    }}
  >
    <CheckCheck className="w-12 h-12 text-emerald-500 relative z-10" />
  </motion.div>
</motion.div>
```

**Also update**: `src/components/layout/NotificationBell.tsx`

Same animation for the bell dropdown empty state.

---

## 4. Archive Feature Implementation

### Requirements

1. **Archive button** on each notification
2. **Archived view** (separate page or tab)
3. **Same categories, colors, animations** as main view
4. **Restore from archive** functionality
5. **Permanent delete** from archive

### Database Schema

```sql
-- Add archived column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

-- Create index for archived notifications
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived, user_id);
```

### Component Structure

**New Component**: `src/components/pages/NotificationArchive.tsx`

```typescript
export default function NotificationArchive() {
  const { archivedNotifications, handleRestore, handlePermanentDelete } = useNotifications();
  
  return (
    <DashboardLayout title="Archived Notifications" subtitle="Review and manage archived alerts">
      {/* Same category cards as main view */}
      {/* Same expandable rows */}
      {/* Additional actions: Restore, Permanent Delete */}
    </DashboardLayout>
  );
}
```

### Hook Updates

**File**: `src/hooks/useNotifications.ts`

```typescript
// Add archived notifications query
const { data: archivedNotifications } = useQuery({
  queryKey: ["archived-notifications", user?.id],
  queryFn: async () => {
    // Fetch archived notifications
  }
});

// Add restore function
const handleRestore = useCallback((id: string) => {
  // Update archived = false
  // Remove from deletedItems
  // Show toast
}, []);

// Add permanent delete function
const handlePermanentDelete = useCallback((id: string) => {
  // Actually delete from database
  // Show confirmation dialog first
  // Show toast
}, []);
```

### Routing

**File**: `src/App.tsx`

```typescript
<Route path="/notifications/archive" element={<NotificationArchive />} />
```

---

## 5. Fix Diagnostic Panel Layout (Horizontal)

### Current State
- Vertical list of diagnostic checks
- Takes up too much vertical space

### Required State
- Horizontal grid layout
- 2-3 columns on desktop
- Responsive on mobile

### Implementation

**File**: `src/components/hr/DiagnosticDialog.tsx`

```typescript
// Change from vertical list to grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
  {steps.map((step, idx) => (
    <motion.div
      key={step.id}
      className="p-3 rounded-xl border"
    >
      {/* Compact card layout */}
      <div className="flex items-center gap-2 mb-2">
        <step.icon className="w-4 h-4" />
        <h4 className="text-xs font-bold flex-1">{step.label}</h4>
        {step.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
      </div>
      <p className="text-[10px] text-muted-foreground">{step.description}</p>
      {step.responseTime && (
        <p className="text-[9px] text-muted-foreground mt-1">{Math.round(step.responseTime)}ms</p>
      )}
    </motion.div>
  ))}
</div>
```

---

## 6. Fix Issue/MOU Creation Panels (Horizontal)

### Current State
- Vertical form layouts
- Long scrolling forms

### Required State
- Horizontal multi-step wizard
- Progress indicator at top
- Compact, modern layout

### Implementation

**File**: `src/components/issues/IssueForm.tsx`

```typescript
// Add step indicator
const [currentStep, setCurrentStep] = useState(1);
const steps = ["Details", "Assignment", "Priority"];

return (
  <div className="space-y-6">
    {/* Horizontal step indicator */}
    <div className="flex items-center justify-between">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            idx + 1 === currentStep ? "bg-primary text-primary-foreground" :
            idx + 1 < currentStep ? "bg-emerald-500 text-white" :
            "bg-muted text-muted-foreground"
          )}>
            {idx + 1 < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
          </div>
          <span className="ml-2 text-sm font-medium">{step}</span>
          {idx < steps.length - 1 && (
            <div className="w-12 h-px bg-border mx-4" />
          )}
        </div>
      ))}
    </div>
    
    {/* Step content */}
    <div className="min-h-[300px]">
      {currentStep === 1 && <DetailsStep />}
      {currentStep === 2 && <AssignmentStep />}
      {currentStep === 3 && <PriorityStep />}
    </div>
    
    {/* Navigation */}
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={() => setCurrentStep(prev => prev - 1)}
        disabled={currentStep === 1}
      >
        Previous
      </Button>
      <Button
        onClick={() => setCurrentStep(prev => prev + 1)}
        disabled={currentStep === steps.length}
      >
        {currentStep === steps.length ? "Create" : "Next"}
      </Button>
    </div>
  </div>
);
```

**Same pattern for**: `src/components/mous/MOUForm.tsx`

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Restore old category cards
2. ✅ Add continuous tick animation with glow
3. ✅ Fix diagnostic panel layout (horizontal)

### Phase 2: Real-Time Notifications (High Priority)
1. 🔄 Create notifications table
2. 🔄 Add database triggers for all actions
3. 🔄 Enhance toast notifications with avatars
4. 🔄 Test real-time subscriptions

### Phase 3: Archive Feature (Medium Priority)
1. 🔄 Add archived column to database
2. 🔄 Create NotificationArchive component
3. 🔄 Add restore/permanent delete functions
4. 🔄 Add routing

### Phase 4: Form Improvements (Low Priority)
1. 🔄 Convert IssueForm to horizontal wizard
2. 🔄 Convert MOUForm to horizontal wizard
3. 🔄 Add progress indicators

---

## Testing Checklist

### Notification System
- [ ] Category cards scroll horizontally
- [ ] Expandable rows work below cards
- [ ] Tick animation is continuous with glow
- [ ] Real-time notifications show with avatars
- [ ] Toast notifications include user names
- [ ] Archive button works
- [ ] Archived view shows correct notifications
- [ ] Restore from archive works
- [ ] Permanent delete works

### Diagnostic Panel
- [ ] Layout is horizontal grid
- [ ] Responsive on mobile
- [ ] All checks display correctly
- [ ] Metrics dashboard shows

### Forms
- [ ] Issue form is horizontal wizard
- [ ] MOU form is horizontal wizard
- [ ] Progress indicators work
- [ ] Navigation between steps works
- [ ] Form validation works

---

**Status**: Ready for implementation  
**Estimated Time**: 4-6 hours for all phases
