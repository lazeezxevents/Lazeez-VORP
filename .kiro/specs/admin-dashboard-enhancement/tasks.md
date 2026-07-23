# Implementation Plan: Admin Dashboard Enhancement

## Overview

This implementation adds four interactive data visualization charts to the Admin Dashboard using Recharts. The charts provide insights into vendor distribution, issue tracking, and onboarding trends. All charts update in real-time using existing data subscriptions.

## Tasks

- [ ] 1. Create chart utility functions and shared types
  - Create `src/components/dashboard/charts/utils.ts` for data transformation functions
  - Export color mapping functions for priorities and statuses
  - Export data transformation functions for each chart type
  - Add TypeScript types for chart data structures
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.2, 3.4, 4.2, 4.3_

- [ ]* 1.1 Write property tests for data transformation utilities
  - **Property 1: Vendor category grouping completeness** - For any vendor array, segment count equals unique categories
  - **Property 2: Vendor category data accuracy** - For any vendor array, sum of segments equals total vendors
  - **Property 3: Issue priority completeness** - For any issue array, always produces 4 priority levels
  - **Property 4: Issue priority count accuracy** - For any issue array, sum of counts equals total issues
  - **Property 5: Issue status distribution accuracy** - For any non-empty issue array, percentages sum to 100%
  - **Property 6: Vendor onboarding trend completeness** - For any vendor array, produces exactly 30 data points
  - **Property 7: Vendor onboarding count accuracy** - For any vendor array, daily counts match actual creation dates
  - **Validates: Requirements 1.2, 1.3, 2.2, 2.4, 3.4, 4.2, 4.3, 4.4**

- [x] 2. Implement VendorCategoryPieChart component
  - [x] 2.1 Create `src/components/dashboard/charts/VendorCategoryPieChart.tsx`
    - Accept `vendors` and `isLoading` props
    - Use transformation utility to group vendors by category
    - Implement Recharts PieChart with cells colored by category
    - Add tooltip showing category name and count
    - Display empty state when no vendors exist
    - Use ResponsiveContainer with 300px height
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write unit tests for VendorCategoryPieChart
    - Test rendering with sample vendor data
    - Test empty state rendering
    - Test loading state rendering
    - _Requirements: 1.1, 1.5, 8.1, 8.4_

- [x] 3. Implement IssuesByPriorityChart component
  - [x] 3.1 Create `src/components/dashboard/charts/IssuesByPriorityChart.tsx`
    - Accept `issues` and `isLoading` props
    - Use transformation utility to group issues by priority
    - Ensure all 4 priority levels present (critical, high, medium, low)
    - Implement Recharts BarChart with color-coded bars
    - Use priority-specific colors from design
    - Add tooltip and count labels
    - Display empty state when no issues exist
    - Use ResponsiveContainer with 350px height
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write unit tests for IssuesByPriorityChart
    - Test rendering with sample issue data
    - Test that all 4 priorities are displayed
    - Test empty state rendering
    - Test loading state rendering
    - _Requirements: 2.1, 2.2, 2.4, 8.1, 8.4_

- [x] 4. Implement IssueStatusDonutChart component
  - [x] 4.1 Create `src/components/dashboard/charts/IssueStatusDonutChart.tsx`
    - Accept `issues` and `isLoading` props
    - Use transformation utility to calculate status distribution
    - Implement Recharts PieChart with innerRadius for donut effect
    - Use status-specific colors matching existing badge colors
    - Display percentage labels on segments
    - Add custom tooltip showing count and percentage
    - Display empty state when no issues exist
    - Use ResponsiveContainer with 300px height
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write unit tests for IssueStatusDonutChart
    - Test rendering with sample issue data
    - Test percentage calculations
    - Test empty state rendering
    - Test loading state rendering
    - _Requirements: 3.1, 3.4, 3.5, 8.1, 8.4_

- [x] 5. Implement VendorOnboardingTrendChart component
  - [x] 5.1 Create `src/components/dashboard/charts/VendorOnboardingTrendChart.tsx`
    - Accept `vendors` and `isLoading` props
    - Use transformation utility to calculate 30-day trend
    - Ensure all 30 days are represented (0 count for days without vendors)
    - Implement Recharts LineChart with monotone curve
    - Format x-axis dates as "MMM dd"
    - Add custom tooltip showing full date and count
    - Display empty state when no vendors exist
    - Use ResponsiveContainer with 350px height
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 Write unit tests for VendorOnboardingTrendChart
    - Test rendering with sample vendor data
    - Test that exactly 30 data points are generated
    - Test empty state rendering
    - Test loading state rendering
    - _Requirements: 4.1, 4.3, 4.4, 8.1, 8.4_

- [ ] 6. Checkpoint - Ensure all chart components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Integrate charts into Dashboard component
  - [ ] 7.1 Add Analytics section to Dashboard.tsx
    - Import all four chart components
    - Create "Analytics" section header below Quick Actions
    - Add large charts row (2-column grid on desktop)
    - Add IssuesByPriorityChart and VendorOnboardingTrendChart as large charts
    - Add small charts row (2-column grid on desktop)
    - Add VendorCategoryPieChart and IssueStatusDonutChart as small charts
    - Wrap each chart in Card component with CardHeader and CardTitle
    - Add Skeleton loading states for each chart
    - Use staggered animation delays (0ms, 80ms, 160ms, 240ms)
    - _Requirements: 6.1, 6.2, 6.6, 6.7, 7.1, 7.2, 7.5, 8.1, 8.3_

  - [ ] 7.2 Add responsive styling for mobile layout
    - Ensure charts stack vertically on mobile (grid-cols-1)
    - Test responsive behavior at different breakpoints
    - Verify chart responsiveness with ResponsiveContainer
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 7.3 Write integration tests for Analytics section
    - Test Analytics section renders below Quick Actions
    - Test all four charts are present in correct positions
    - Test responsive layout behavior
    - Test loading states for all charts
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

- [ ] 8. Verify real-time updates
  - [ ] 8.1 Test chart reactivity with existing subscriptions
    - Verify charts update when vendor data changes
    - Verify charts update when issue data changes via existing subscription
    - Confirm no new Supabase subscriptions were added
    - Verify React Query invalidation triggers chart re-renders
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Final styling and polish
  - [ ] 9.1 Apply design system consistency
    - Verify all charts use theme colors (CSS variables)
    - Ensure tooltips match existing design patterns
    - Verify card styling matches existing dashboard cards
    - Test animations and transitions
    - Add hover effects where appropriate
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 9.2 Write visual regression tests
    - Add snapshot tests for each chart component
    - Test different data scenarios (empty, single item, multiple items)
    - Verify color consistency
    - _Requirements: 7.3, 7.4_

- [ ] 10. Final checkpoint - Comprehensive testing
  - Verify all charts render correctly with real data
  - Test loading, empty, and error states
  - Verify responsive behavior on different screen sizes
  - Confirm real-time updates work as expected
  - Ensure no console errors or warnings
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All chart components are self-contained and can be developed in parallel (tasks 2-5)
- Data transformation utilities should be created first to enable property-based testing
- Real-time updates work automatically through existing subscriptions - no additional setup needed
- All dependencies (recharts, date-fns) are already installed
- Charts use existing design system colors and components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["1.1", "2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "5.2"] },
    { "id": 3, "tasks": ["7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 5, "tasks": ["9.1", "9.2"] }
  ]
}
```
