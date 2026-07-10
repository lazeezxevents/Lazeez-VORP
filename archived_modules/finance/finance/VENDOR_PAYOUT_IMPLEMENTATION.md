# Vendor Payout Processing Implementation

## Overview

This document describes the implementation of Task 17.3: Vendor Payout Processing UI components for the Finance Module.

## Requirements Addressed

- **Requirement 6.1**: Calculate net payout as remaining amount minus commission
- **Requirement 6.2**: Deduct upfront payment percentage from total payout
- **Requirement 6.3**: Deduct vendor commission from remaining amount
- **Requirement 6.4**: Ensure net payout is non-negative
- **Requirement 6.5**: Create journal entries for payout and update vendor balance

## Components Implemented

### 1. useVendorPayouts Hook (`useVendorPayouts.ts`)

TanStack Query hook providing data fetching and mutations for vendor payouts.

**Features:**
- `usePendingPayouts()` - Fetches pending payouts awaiting processing
- `usePayoutHistory(vendorId?)` - Fetches completed payout history with optional vendor filter
- `usePayoutSummary()` - Fetches summary statistics (pending, processing, completed)
- `usePayoutDetail(orderId)` - Fetches detailed payout information for a specific order
- `useProcessPayout()` - Mutation to process vendor payout
- `usePayoutSubscription()` - Real-time subscription for payout updates

**Query Keys:**
```typescript
const payoutKeys = {
  all: ["vendor-payouts"],
  lists: () => [...payoutKeys.all, "list"],
  list: (filters) => [...payoutKeys.lists(), filters],
  details: () => [...payoutKeys.all, "detail"],
  detail: (id) => [...payoutKeys.details(), id],
  summary: () => [...payoutKeys.all, "summary"],
  history: (vendorId) => [...payoutKeys.all, "history", vendorId],
};
```

**Auto-refresh:**
- Pending payouts: Refetch every 60 seconds
- Summary: Refetch every 60 seconds
- Real-time updates via Supabase subscriptions

### 2. VendorPayoutDashboard (`VendorPayoutDashboard.tsx`)

Main dashboard showing pending payouts with summary cards and action buttons.

**Features:**
- Summary cards showing:
  - Total pending payouts amount
  - Total processing payouts amount
  - Total completed today amount
  - Number of unique vendors with pending payouts
- List of pending payouts with:
  - Vendor name and order number
  - Order amount, commission, and upfront details
  - Net payout calculation
  - "Process payout" action button
  - Click to view detailed breakdown
- Staggered entry animations using Framer Motion
- Empty state when no pending payouts
- Confirmation dialog before processing

**UI Patterns:**
- Hover lift effect on summary cards
- Color-coded status indicators (warning for pending, success for completed)
- Responsive grid layout (4 columns on desktop, 2 on tablet, 1 on mobile)
- Smooth animations with 50ms stagger delay

### 3. PayoutDetailView (`PayoutDetailView.tsx`)

Detailed breakdown view showing payout calculation and status.

**Features:**
- Vendor information card
- Payout breakdown showing:
  - Order amount (total order value)
  - Upfront payment deduction with percentage
  - Remaining amount after upfront
  - Commission deduction with rate
  - Net payout (highlighted in success color)
  - Calculation formula explanation
- Payment status indicators:
  - Pending: Warning badge with clock icon
  - Processing: Info badge with alert icon
  - Completed: Success badge with checkmark icon
  - Failed: Destructive badge with alert icon
- Status-specific alerts:
  - Completed: Shows completion date and time
  - Pending: Shows awaiting processing message
- "Process payout" button for pending payouts

**Calculation Display:**
```
Net Payout = Remaining Amount - Commission
₨X,XXX = ₨Y,YYY - ₨Z,ZZZ
```

### 4. PayoutHistoryView (`PayoutHistoryView.tsx`)

Table view of completed payouts with filtering capabilities.

**Features:**
- Vendor filter dropdown (all vendors or specific vendor)
- Sortable table with columns:
  - Order number
  - Vendor name
  - Completed date
  - Order amount
  - Commission (shown in red)
  - Net payout (shown in green)
  - Status badge (completed)
  - View details action
- Summary footer showing:
  - Total number of completed payouts
  - Total amount paid out
  - Total commission collected
- Click any row to view detailed breakdown
- Empty state when no history available
- Staggered entry animations

**Filter Behavior:**
- "All vendors" shows complete history
- Selecting a vendor filters to that vendor's payouts only
- Filter persists across component re-renders

### 5. VendorPayoutExample (`VendorPayoutExample.tsx`)

Example integration component demonstrating usage.

**Features:**
- Tabbed interface with Dashboard and History tabs
- Integration notes explaining component usage
- Can be used as standalone page or integrated into Finance module

## Data Flow

### Payout Processing Flow

1. **User Action**: User clicks "Process payout" button
2. **Confirmation**: System shows confirmation dialog
3. **Service Call**: `useProcessPayout` mutation calls `accountsPayableService.processVendorPayout()`
4. **Backend Processing**:
   - Fetches order financial data from `finance_order_data` table
   - Validates payout hasn't been processed already
   - Calculates net payout: `remaining_amount - commission_amount`
   - Validates net payout is non-negative (Requirement 6.4)
   - Creates journal entries:
     - Debit: Accounts Payable
     - Credit: Cash
   - Updates order payout status to "completed"
   - Updates vendor financial profile (total payouts, last payout date)
   - Creates audit log entry
   - Sends notification to vendor
5. **UI Update**: Query invalidation triggers automatic refetch
6. **Success Feedback**: Toast notification confirms success

### Real-time Updates

Components subscribe to database changes via Supabase real-time:

```typescript
supabase
  .channel("payout-updates")
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "finance_order_data",
  }, (payload) => {
    // Invalidate queries to refetch
  })
  .subscribe();
```

## Integration Guide

### Basic Integration

```tsx
import { VendorPayoutDashboard, PayoutHistoryView } from "@/components/finance";

// In your Finance page or Accounts Payable section
function FinancePage() {
  return (
    <div>
      <h1>Vendor Payouts</h1>
      <VendorPayoutDashboard />
      <PayoutHistoryView />
    </div>
  );
}
```

### Tabbed Integration

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorPayoutDashboard, PayoutHistoryView } from "@/components/finance";

function PayoutsPage() {
  return (
    <Tabs defaultValue="dashboard">
      <TabsList>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        <VendorPayoutDashboard />
      </TabsContent>
      <TabsContent value="history">
        <PayoutHistoryView />
      </TabsContent>
    </Tabs>
  );
}
```

### Standalone Payout Detail

```tsx
import { PayoutDetailView } from "@/components/finance";

function OrderDetailPage({ orderId }) {
  return (
    <div>
      <h2>Order Details</h2>
      {/* Other order info */}
      <PayoutDetailView orderId={orderId} />
    </div>
  );
}
```

## Design System Compliance

### Typography
- ✅ No ALL CAPS text
- ✅ Sentence case for labels ("Net payout", "Process payout")
- ✅ Title case for page headings ("Vendor Payouts")
- ✅ Proper font hierarchy (text-2xl for titles, text-base for cards)

### Animations
- ✅ Framer Motion for all animations
- ✅ Staggered entry with 50ms delay
- ✅ Hover lift effect on cards (hover-lift class)
- ✅ Button scale on hover (whileHover, whileTap)
- ✅ Smooth transitions (300-400ms duration)

### Colors
- ✅ Success color for completed/net payout (hsl(var(--success)))
- ✅ Warning color for pending (hsl(var(--warning)))
- ✅ Info color for processing (hsl(var(--info)))
- ✅ Destructive color for commission/failed (hsl(var(--destructive)))
- ✅ Muted foreground for secondary text

### Accessibility
- ✅ Semantic HTML (button, table, dialog)
- ✅ Keyboard navigation support
- ✅ Focus indicators on interactive elements
- ✅ ARIA labels for icon-only buttons
- ✅ Color contrast meets WCAG AA standards

### Loading States
- ✅ Skeleton components during data fetch
- ✅ Disabled buttons during mutations
- ✅ Loading indicators on async actions

### Empty States
- ✅ Meaningful icons (CheckCircle for success, Receipt for empty)
- ✅ Clear messaging ("All payouts processed")
- ✅ Helpful guidance text

## Performance Considerations

### Query Optimization
- Stale time: 30 seconds for most queries
- Refetch interval: 60 seconds for dashboard data
- Cursor-based pagination ready (not implemented yet)
- Indexed database queries on `payout_status`, `vendor_id`, `order_id`

### Animation Performance
- Uses GPU-accelerated properties (transform, opacity)
- Avoids animating layout properties (width, height)
- Stagger delay optimized at 50ms

### Bundle Size
- Components use tree-shakeable imports
- Shared UI components from shadcn/ui
- No heavy dependencies added

## Testing Recommendations

### Unit Tests
- Test payout calculation logic
- Test query key generation
- Test mutation success/error handling
- Test filter logic in history view

### Integration Tests
- Test complete payout processing flow
- Test real-time subscription updates
- Test error scenarios (negative payout, missing data)
- Test vendor filter functionality

### E2E Tests
- Test user can view pending payouts
- Test user can process a payout
- Test user can view payout history
- Test user can filter by vendor
- Test user can view payout details

## Future Enhancements

### Potential Improvements
1. **Bulk Processing**: Process multiple payouts at once
2. **Export**: Export payout history to CSV/Excel
3. **Scheduling**: Schedule payouts for future dates
4. **Payment Methods**: Support multiple payment methods (bank transfer, PayPal, etc.)
5. **Approval Workflow**: Multi-level approval for large payouts
6. **Notifications**: Email/SMS notifications to vendors
7. **Analytics**: Payout trends and vendor performance charts
8. **Search**: Search payouts by order number, vendor name, date range
9. **Pagination**: Implement cursor-based pagination for large datasets
10. **Filters**: Additional filters (date range, amount range, payment method)

## Dependencies

### Required Packages
- `@tanstack/react-query` - Data fetching and caching
- `framer-motion` - Animations
- `date-fns` - Date formatting
- `lucide-react` - Icons
- `sonner` - Toast notifications
- `@/components/ui/*` - shadcn/ui components

### Database Tables
- `finance_order_data` - Order financial data with payout status
- `finance_vendor_profiles` - Vendor financial profiles
- `finance_accounts` - Chart of accounts for journal entries
- `finance_journal_entries` - Journal entries for payouts
- `finance_ledger_entries` - Ledger entries for double-entry bookkeeping
- `notifications` - Notification system integration

## Troubleshooting

### Common Issues

**Issue**: Payouts not appearing in dashboard
- **Solution**: Check `finance_order_data` table has records with `payout_status = 'pending'` and `remaining_paid = false`

**Issue**: Process payout button disabled
- **Solution**: Ensure user is authenticated and has proper permissions

**Issue**: Net payout calculation incorrect
- **Solution**: Verify commission calculation in `CommissionEngineService` and order data in `finance_order_data`

**Issue**: Real-time updates not working
- **Solution**: Check Supabase real-time is enabled and subscription is active

**Issue**: History view empty
- **Solution**: Ensure there are completed payouts with `payout_status = 'completed'`

## Conclusion

The vendor payout processing UI provides a complete solution for managing vendor payouts with:
- Clear visibility into pending and completed payouts
- Detailed breakdown of payout calculations
- One-click payout processing with confirmation
- Real-time updates and automatic refresh
- Full compliance with design system standards
- Comprehensive error handling and user feedback

The implementation follows best practices for React, TypeScript, TanStack Query, and Framer Motion, ensuring maintainability, performance, and excellent user experience.
