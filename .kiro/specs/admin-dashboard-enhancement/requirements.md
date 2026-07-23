# Requirements Document

## Introduction

This document specifies the requirements for enhancing the Admin Dashboard with interactive data visualization charts. The enhancement adds four Recharts-based charts to provide visual insights into vendor distribution, issue tracking, and onboarding trends. The charts will use existing data sources and update in real-time.

## Glossary

- **Dashboard**: The main admin dashboard page component located at `src/components/pages/Dashboard.tsx`
- **Chart**: A visual data representation component using Recharts library
- **Analytics_Section**: A new section in the Dashboard containing all data visualization charts
- **Vendor_Category**: The classification of vendors (home_chef, bakery, catering, restaurant, etc.)
- **Issue_Priority**: The urgency level of an issue (critical, high, medium, low)
- **Issue_Status**: The current state of an issue (open, in_progress, resolved, closed)
- **Real-time_Update**: Automatic refresh of chart data when underlying data changes via Supabase subscriptions
- **Mixed_Layout**: A responsive grid layout with 2 large charts on top and 2 smaller charts below

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to see a visual breakdown of vendor distribution by category, so that I can understand the composition of my vendor base at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Pie Chart showing vendor distribution by Vendor_Category
2. WHEN vendors exist in the system, THE Pie Chart SHALL display one segment per unique Vendor_Category
3. THE Pie Chart SHALL display the category name and count for each segment
4. THE Pie Chart SHALL use distinct colors for each category segment
5. WHEN no vendors exist, THE Pie Chart SHALL display an empty state message
6. THE Pie Chart SHALL be positioned in the Analytics_Section in a smaller card below the large charts

### Requirement 2

**User Story:** As an administrator, I want to see a bar chart of issues grouped by priority, so that I can quickly identify where critical attention is needed.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Bar Chart showing issue counts grouped by Issue_Priority
2. THE Bar Chart SHALL include four bars for critical, high, medium, and low priorities
3. THE Bar Chart SHALL use priority-specific colors (critical: red, high: orange, medium: yellow, low: blue)
4. WHEN an Issue_Priority level has zero issues, THE Bar Chart SHALL still display that bar with value 0
5. THE Bar Chart SHALL display count labels on or above each bar
6. THE Bar Chart SHALL be positioned in the Analytics_Section as one of the two large charts

### Requirement 3

**User Story:** As an administrator, I want to see the distribution of issue statuses, so that I can monitor resolution progress and identify bottlenecks.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Donut Chart showing issue distribution by Issue_Status
2. THE Donut Chart SHALL include segments for open, in_progress, resolved, and closed statuses
3. THE Donut Chart SHALL use status-specific colors matching existing status badge colors
4. THE Donut Chart SHALL display the percentage and count for each status segment
5. WHEN no issues exist, THE Donut Chart SHALL display an empty state message
6. THE Donut Chart SHALL be positioned in the Analytics_Section in a smaller card below the large charts

### Requirement 4

**User Story:** As an administrator, I want to see vendor onboarding trends over time, so that I can track growth patterns and identify successful recruitment periods.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Line Chart showing vendor onboarding over the last 30 days
2. THE Line Chart SHALL display daily vendor creation counts on the y-axis and dates on the x-axis
3. THE Line Chart SHALL include data points for each day in the 30-day period
4. WHEN no vendors were created on a specific day, THE Line Chart SHALL display that day with a count of 0
5. THE Line Chart SHALL use a smooth curve interpolation for the line
6. THE Line Chart SHALL be positioned in the Analytics_Section as one of the two large charts

### Requirement 5

**User Story:** As an administrator, I want all charts to update automatically when data changes, so that I always see current information without manual refresh.

#### Acceptance Criteria

1. WHEN vendor data changes via Supabase subscription, THE Dashboard SHALL update all vendor-related charts
2. WHEN issue data changes via Supabase subscription, THE Dashboard SHALL update all issue-related charts
3. THE Dashboard SHALL recompute chart data when the underlying query data changes
4. THE Dashboard SHALL preserve existing real-time subscription behavior for issues
5. THE Dashboard SHALL not introduce new Supabase subscriptions beyond existing ones

### Requirement 6

**User Story:** As an administrator, I want the charts to be responsive and properly laid out, so that I can view analytics on different screen sizes.

#### Acceptance Criteria

1. THE Analytics_Section SHALL display below the Quick Actions section in the Dashboard
2. THE Analytics_Section SHALL use a Mixed_Layout with 2 large charts on top and 2 smaller charts below
3. ON desktop screens, THE Dashboard SHALL display the large charts in a 2-column grid
4. ON desktop screens, THE Dashboard SHALL display the smaller charts in a 2-column grid
5. ON mobile screens, THE Dashboard SHALL stack all charts vertically
6. THE Bar Chart and Line Chart SHALL occupy the large chart positions
7. THE Pie Chart and Donut Chart SHALL occupy the smaller chart positions

### Requirement 7

**User Story:** As an administrator, I want the charts to follow the existing dashboard design system, so that the interface remains visually consistent.

#### Acceptance Criteria

1. THE Analytics_Section SHALL use the same Card component as existing dashboard sections
2. THE Chart cards SHALL include CardHeader with CardTitle components
3. THE Chart colors SHALL use existing Tailwind theme colors (gradient-primary, priority colors, status colors)
4. THE Charts SHALL include tooltips on hover showing detailed information
5. THE Charts SHALL use the same animation classes as existing dashboard elements
6. THE Chart cards SHALL match the styling of existing stat cards (padding, borders, shadows)

### Requirement 8

**User Story:** As an administrator, I want the charts to handle loading and error states gracefully, so that I have a smooth user experience even when data is unavailable.

#### Acceptance Criteria

1. WHILE chart data is loading, THE Dashboard SHALL display Skeleton placeholders in chart card positions
2. IF chart data fails to load, THE Dashboard SHALL display an error message in the affected chart card
3. THE Skeleton placeholders SHALL match the dimensions of the actual charts
4. THE Dashboard SHALL not crash or display broken UI when data is unavailable
5. WHEN data becomes available after initial load, THE Charts SHALL render without page refresh
