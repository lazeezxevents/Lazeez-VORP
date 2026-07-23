# Design Document: Admin Dashboard Enhancement

## Overview

This design enhances the existing Admin Dashboard with four interactive data visualization charts using Recharts 2.15.4. The charts provide visual insights into vendor distribution, issue tracking, and onboarding trends. All charts will update in real-time using existing Supabase subscriptions without introducing new subscription overhead.

## Architecture

### Component Hierarchy

```
Dashboard (existing)
└── Analytics Section (new)
    ├── Large Charts Row
    │   ├── IssuesByPriorityChart (Bar Chart)
    │   └── VendorOnboardingTrendChart (Line Chart)
    └── Small Charts Row
        ├── VendorCategoryPieChart (Pie Chart)
        └── IssueStatusDonutChart (Donut Chart)
```

### Data Flow

```
useVendors() hook → vendors[] → VendorCategoryPieChart
                              → VendorOnboardingTrendChart

useIssues() hook → issues[] → IssuesByPriorityChart
                            → IssueStatusDonutChart
```

## Components

### 1. VendorCategoryPieChart

**Purpose**: Display vendor distribution by category as a pie chart.

**Props**:
```typescript
interface VendorCategoryPieChartProps {
  vendors: Vendor[];
  isLoading: boolean;
}
```

**Data Transformation**:
```typescript
function transformVendorCategories(vendors: Vendor[]) {
  const categoryMap = vendors.reduce((acc, vendor) => {
    const category = vendor.category;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<VendorCategory, number>);

  return Object.entries(categoryMap).map(([name, value]) => ({
    name: formatCategoryName(name),
    value,
    category: name
  }));
}

function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Recharts Configuration**:
```typescript
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={data}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={80}
      label={(entry) => `${entry.name}: ${entry.value}`}
    >
      {data.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

**Colors**: Use Tailwind theme colors via CSS variables:
- `hsl(var(--chart-1))` through `hsl(var(--chart-5))`

**Empty State**: Display "No vendors yet" message when `vendors.length === 0`

---

### 2. IssuesByPriorityChart

**Purpose**: Display issue counts grouped by priority as a bar chart with color-coded bars.

**Props**:
```typescript
interface IssuesByPriorityChartProps {
  issues: Issue[];
  isLoading: boolean;
}
```

**Data Transformation**:
```typescript
const PRIORITY_ORDER: IssuePriority[] = ['critical', 'high', 'medium', 'low'];

function transformIssuePriorities(issues: Issue[]) {
  const priorityCounts = issues.reduce((acc, issue) => {
    acc[issue.priority] = (acc[issue.priority] || 0) + 1;
    return acc;
  }, {} as Record<IssuePriority, number>);

  // Ensure all priorities are present, even with 0 count
  return PRIORITY_ORDER.map(priority => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: priorityCounts[priority] || 0,
    fill: getPriorityColor(priority)
  }));
}

function getPriorityColor(priority: IssuePriority): string {
  const colors = {
    critical: 'hsl(var(--destructive))',
    high: 'hsl(var(--warning))',
    medium: 'hsl(var(--chart-3))',
    low: 'hsl(var(--info))'
  };
  return colors[priority];
}
```

**Recharts Configuration**:
```typescript
<ResponsiveContainer width="100%" height={350}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="priority" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
      {data.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.fill} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

**Empty State**: Display "No issues yet" when `issues.length === 0`

---

### 3. IssueStatusDonutChart

**Purpose**: Display issue distribution by status as a donut chart with percentages.

**Props**:
```typescript
interface IssueStatusDonutChartProps {
  issues: Issue[];
  isLoading: boolean;
}
```

**Data Transformation**:
```typescript
const STATUS_ORDER: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

function transformIssueStatuses(issues: Issue[]) {
  const total = issues.length;
  if (total === 0) return [];

  const statusCounts = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {} as Record<IssueStatus, number>);

  return STATUS_ORDER
    .map(status => ({
      name: formatStatusName(status),
      value: statusCounts[status] || 0,
      percentage: total > 0 ? Math.round((statusCounts[status] || 0) / total * 100) : 0,
      fill: getStatusColor(status)
    }))
    .filter(item => item.value > 0); // Only show statuses with issues
}

function formatStatusName(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getStatusColor(status: IssueStatus): string {
  const colors = {
    open: 'hsl(var(--info))',
    in_progress: 'hsl(var(--warning))',
    resolved: 'hsl(var(--success))',
    closed: 'hsl(var(--muted-foreground))'
  };
  return colors[status];
}
```

**Recharts Configuration**:
```typescript
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={data}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={80}
      label={(entry) => `${entry.percentage}%`}
    >
      {data.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.fill} />
      ))}
    </Pie>
    <Tooltip 
      content={({ active, payload }) => {
        if (active && payload && payload.length) {
          return (
            <div className="bg-background border border-border p-2 rounded shadow-sm">
              <p className="text-sm">{payload[0].payload.name}</p>
              <p className="text-sm font-bold">{payload[0].value} ({payload[0].payload.percentage}%)</p>
            </div>
          );
        }
        return null;
      }}
    />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

**Empty State**: Display "No issues yet" when `issues.length === 0`

---

### 4. VendorOnboardingTrendChart

**Purpose**: Display vendor onboarding counts over the last 30 days as a line chart.

**Props**:
```typescript
interface VendorOnboardingTrendChartProps {
  vendors: Vendor[];
  isLoading: boolean;
}
```

**Data Transformation**:
```typescript
function transformVendorOnboardingTrend(vendors: Vendor[]) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29); // Include today = 30 days

  // Initialize all days with 0 count
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(thirtyDaysAgo);
    date.setDate(thirtyDaysAgo.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    dailyCounts[dateKey] = 0;
  }

  // Count vendors by creation date
  vendors.forEach(vendor => {
    const createdDate = new Date(vendor.created_at).toISOString().split('T')[0];
    if (dailyCounts.hasOwnProperty(createdDate)) {
      dailyCounts[createdDate]++;
    }
  });

  // Convert to array format for Recharts
  return Object.entries(dailyCounts)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => ({
      date: format(new Date(date), 'MMM dd'),
      fullDate: date,
      count
    }));
}
```

**Recharts Configuration**:
```typescript
<ResponsiveContainer width="100%" height={350}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis 
      dataKey="date" 
      tick={{ fontSize: 12 }}
      interval="preserveStartEnd"
    />
    <YAxis />
    <Tooltip 
      content={({ active, payload }) => {
        if (active && payload && payload.length) {
          return (
            <div className="bg-background border border-border p-2 rounded shadow-sm">
              <p className="text-sm">{payload[0].payload.fullDate}</p>
              <p className="text-sm font-bold">{payload[0].value} vendors</p>
            </div>
          );
        }
        return null;
      }}
    />
    <Line 
      type="monotone" 
      dataKey="count" 
      stroke="hsl(var(--primary))" 
      strokeWidth={2}
      dot={{ fill: 'hsl(var(--primary))' }}
    />
  </LineChart>
</ResponsiveContainer>
```

**Empty State**: Display "No vendors yet" when `vendors.length === 0`

---

## Layout Implementation

### Analytics Section Component

```typescript
// In Dashboard.tsx, add after Quick Actions section

<div className="space-y-6">
  <div className="flex items-center justify-between">
    <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
  </div>

  {/* Large Charts Row */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Issues by Priority</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <IssuesByPriorityChart issues={issues || []} isLoading={issuesLoading} />
        )}
      </CardContent>
    </Card>

    <Card className="animate-fade-in" style={{ animationDelay: '80ms' }}>
      <CardHeader>
        <CardTitle>Vendor Onboarding Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <VendorOnboardingTrendChart vendors={vendors || []} isLoading={vendorsLoading} />
        )}
      </CardContent>
    </Card>
  </div>

  {/* Small Charts Row */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="animate-fade-in" style={{ animationDelay: '160ms' }}>
      <CardHeader>
        <CardTitle>Vendor Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <VendorCategoryPieChart vendors={vendors || []} isLoading={vendorsLoading} />
        )}
      </CardContent>
    </Card>

    <Card className="animate-fade-in" style={{ animationDelay: '240ms' }}>
      <CardHeader>
        <CardTitle>Issue Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <IssueStatusDonutChart issues={issues || []} isLoading={issuesLoading} />
        )}
      </CardContent>
    </Card>
  </div>
</div>
```

## Real-Time Updates

The charts will automatically update when data changes because:

1. **Existing Subscriptions**: The `useIssues()` hook already has a Supabase real-time subscription that invalidates queries on changes
2. **React Query Reactivity**: The `useVendors()` hook uses React Query, which will trigger re-renders when data changes
3. **Component Re-rendering**: All chart components accept `vendors` and `issues` as props, so they re-render when the parent Dashboard component receives new data

**No new subscriptions are needed** - the existing infrastructure handles real-time updates.

## Error Handling

### Loading States
- Display `<Skeleton>` components matching chart dimensions while `isLoading` is true
- Skeleton heights: 350px for large charts, 300px for small charts

### Empty States
- Each chart component checks if data array is empty
- Display centered message with icon: "No vendors yet" or "No issues yet"
- Use existing Lucide icons: `Building2` for vendors, `Ticket` for issues

### Error States
- Since data comes from existing hooks, error handling is already implemented in `useVendors()` and `useIssues()`
- If hooks return `undefined`, treat as empty array: `vendors || []`

## Styling

### Theme Integration
- Use existing Tailwind CSS variables: `--primary`, `--destructive`, `--warning`, `--success`, `--info`, `--muted-foreground`
- Chart colors: `--chart-1` through `--chart-5` for categorical data
- Maintain existing card styling: `Card`, `CardHeader`, `CardTitle`, `CardContent` components

### Animations
- Use existing animation classes: `animate-fade-in` with staggered delays
- Delay pattern: 0ms, 80ms, 160ms, 240ms for four charts

### Responsive Design
- Large charts: `height={350}` 
- Small charts: `height={300}`
- Grid breakpoints: `grid-cols-1 lg:grid-cols-2`
- Mobile: Stack all charts vertically

## File Structure

```
src/components/dashboard/
├── charts/
│   ├── VendorCategoryPieChart.tsx
│   ├── IssuesByPriorityChart.tsx
│   ├── IssueStatusDonutChart.tsx
│   └── VendorOnboardingTrendChart.tsx
└── AnalyticsSection.tsx (optional wrapper)

src/components/pages/
└── Dashboard.tsx (modified)
```

## Dependencies

All dependencies are already installed:
- `recharts: ^2.15.4` ✅
- `date-fns: ^3.6.0` ✅ (for date formatting)
- `lucide-react` ✅ (for icons)

No new dependencies required.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Vendor category grouping completeness

*For any* array of vendors, the number of segments in the pie chart data should equal the number of unique categories present in the vendor array.

**Validates: Requirements 1.2**

### Property 2: Vendor category data accuracy

*For any* array of vendors, the sum of all segment values in the pie chart data should equal the total number of vendors, and each category's count should match the number of vendors with that category.

**Validates: Requirements 1.3**

### Property 3: Issue priority completeness

*For any* array of issues (including an empty array), the bar chart data transformation should always produce exactly 4 items representing all priority levels (critical, high, medium, low) in that specific order.

**Validates: Requirements 2.2, 2.4**

### Property 4: Issue priority count accuracy

*For any* array of issues, the sum of all priority counts in the bar chart data should equal the total number of issues, and each priority's count should match the number of issues with that priority level (including 0 for priorities with no issues).

**Validates: Requirements 2.4**

### Property 5: Issue status distribution accuracy

*For any* non-empty array of issues, the sum of all status counts in the donut chart data should equal the total number of issues, and the sum of all percentages should equal 100%.

**Validates: Requirements 3.4**

### Property 6: Vendor onboarding trend completeness

*For any* array of vendors, the line chart data transformation should always produce exactly 30 data points representing consecutive days, regardless of whether vendors were created on those days.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 7: Vendor onboarding count accuracy

*For any* array of vendors and any date within the 30-day window, the count for that date in the line chart data should equal the number of vendors whose `created_at` date matches that date, or 0 if no vendors were created on that date.

**Validates: Requirements 4.3, 4.4**

---

## Implementation Notes

1. **Chart Components**: Create individual chart components in `src/components/dashboard/charts/` for better organization and testability
2. **Data Transformation**: Extract data transformation logic into separate functions for easier testing
3. **Type Safety**: Use existing TypeScript types (`Vendor`, `Issue`, `VendorCategory`, `IssuePriority`, `IssueStatus`) from hooks
4. **Reusability**: Each chart component should be self-contained and reusable with only `data` and `isLoading` props
5. **Performance**: Data transformations run on every render - this is acceptable for dashboard scale (typically <1000 items), but could be memoized with `useMemo` if needed
