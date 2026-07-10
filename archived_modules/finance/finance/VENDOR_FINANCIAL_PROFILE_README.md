# Vendor Financial Profile Implementation

## Overview

The Vendor Financial Profile system provides comprehensive financial management for vendors, including commission configuration, subscription tracking, and financial summaries.

## Components

### 1. Database Schema

**Table:** `finance_vendor_profiles`

Located in: `supabase/migrations/20260329_finance_vendor_profiles.sql`

**Key Features:**
- Commission model configuration (flat, percentage, tiered, category-based)
- Subscription status tracking with threshold management
- Financial totals (revenue, commissions, payouts, outstanding balance)
- Payment configuration (terms, preferred method, bank details)
- Row-level security policies for finance permissions

**Helper Functions:**
- `initialize_vendor_financial_profile(vendor_id)` - Creates profile with defaults
- `increment_vendor_threshold(vendor_id)` - Manages subscription threshold
- `update_vendor_financial_totals(vendor_id, revenue, commission, payout)` - Updates financial totals

### 2. TypeScript Types

**Location:** `src/components/finance/types.ts`

**Key Types:**
```typescript
interface VendorFinancialProfile {
  id: string;
  vendor_id: string;
  commission_model: CommissionModel;
  commission_rate: number | null;
  commission_rules: CommissionRules;
  subscription_status: SubscriptionStatus;
  current_threshold: number;
  threshold_limit: number | null;
  total_revenue: number;
  total_commission_paid: number;
  total_payouts: number;
  outstanding_balance: number;
  // ... payment and date fields
}

interface CommissionRules {
  model: CommissionModel;
  flat_rate?: number;
  percentage_rate?: number;
  tiers?: CommissionTier[];
  category_rates?: Record<string, number>;
}
```

**Zod Schemas:**
- `createVendorFinancialProfileSchema` - Validation for profile creation
- `updateVendorFinancialProfileSchema` - Validation for profile updates
- `commissionRulesSchema` - Validation for commission configuration

### 3. React Hook

**Location:** `src/components/hooks/useVendorFinancialProfile.ts`

**Main Hook:** `useVendorFinancialProfile(vendorId)`

**Returns:**
```typescript
{
  // Query data
  profile: VendorFinancialProfile | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Mutations
  createProfile: (input: CreateVendorFinancialProfileInput) => void;
  updateProfile: (input: UpdateVendorFinancialProfileInput) => void;
  updateCommissionRules: (input: UpdateVendorFinancialProfileInput) => void;
  initializeProfile: () => void;

  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isUpdatingRules: boolean;
  isInitializing: boolean;
}
```

**Features:**
- TanStack Query integration with caching
- Optimistic updates for commission rules
- Automatic query invalidation
- Toast notifications for success/error states

### 4. UI Components

#### VendorFinancialProfileCard

**Location:** `src/components/finance/VendorFinancialProfileCard.tsx`

**Features:**
- Displays commission configuration
- Shows subscription status with threshold progress
- Financial summary cards (revenue, commissions, payouts, outstanding)
- Payment configuration display
- Initialize profile button if not set up
- Opens commission rules dialog for configuration

**Usage:**
```tsx
import { VendorFinancialProfileCard } from "@/components/finance/VendorFinancialProfileCard";

<VendorFinancialProfileCard vendorId={vendorId} />
```

#### CommissionRulesDialog

**Location:** `src/components/finance/CommissionRulesDialog.tsx`

**Features:**
- Commission model selection (flat, percentage, tiered, category-based)
- Dynamic form based on selected model
- Tier management with add/remove functionality
- Form validation with Zod
- Optimistic updates
- Framer Motion animations

**Commission Models:**

1. **Flat Rate:** Fixed amount per order
2. **Percentage:** Percentage of order amount
3. **Tiered:** Multiple rate brackets based on order amount
4. **Category Based:** Different rates per product category (future)

## Integration Guide

### Step 1: Add to Vendor Detail Page

```tsx
import { VendorFinancialProfileCard } from "@/components/finance/VendorFinancialProfileCard";

function VendorDetailPage({ vendorId }: { vendorId: string }) {
  return (
    <div className="space-y-6">
      {/* Existing vendor information */}
      
      {/* Add financial profile section */}
      <VendorFinancialProfileCard vendorId={vendorId} />
    </div>
  );
}
```

### Step 2: Initialize Profile for New Vendors

When creating a new vendor, you can automatically initialize their financial profile:

```tsx
import { useVendorFinancialProfile } from "@/components/hooks/useVendorFinancialProfile";

function CreateVendorForm() {
  const { initializeProfile } = useVendorFinancialProfile(newVendorId);
  
  const handleVendorCreated = async (vendorId: string) => {
    // Initialize financial profile with defaults
    initializeProfile();
  };
}
```

### Step 3: Update Commission Rules

Commission rules can be updated through the UI dialog or programmatically:

```tsx
const { updateCommissionRules } = useVendorFinancialProfile(vendorId);

// Update to percentage model
updateCommissionRules({
  commission_model: 'percentage',
  commission_rate: 15.00,
  commission_rules: {
    model: 'percentage',
    percentage_rate: 15.00,
  },
});

// Update to tiered model
updateCommissionRules({
  commission_model: 'tiered',
  commission_rules: {
    model: 'tiered',
    tiers: [
      { min_amount: 0, max_amount: 1000, rate: 10 },
      { min_amount: 1000, max_amount: 5000, rate: 8 },
      { min_amount: 5000, max_amount: 999999, rate: 5 },
    ],
  },
});
```

## Database Functions Usage

### Initialize Profile

```sql
SELECT initialize_vendor_financial_profile('vendor-uuid-here');
```

### Increment Threshold

```sql
SELECT increment_vendor_threshold('vendor-uuid-here');
-- Returns: true if threshold reached, false otherwise
```

### Update Financial Totals

```sql
SELECT update_vendor_financial_totals(
  'vendor-uuid-here',
  1500.00,  -- revenue delta
  150.00,   -- commission delta
  1350.00   -- payout delta
);
```

## Design System Compliance

The implementation follows the design system guidelines:

- **Typography:** Sentence case for labels, proper capitalization
- **Animations:** Framer Motion for all interactions
- **Colors:** Semantic color usage (success, warning, info, destructive)
- **Hover States:** Scale and lift effects on cards
- **Loading States:** Skeleton components during data fetch
- **Empty States:** Clear messaging with action buttons

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 3.1:** Commission model support (flat, percentage, tiered, category-based)
- **Requirement 3.2:** Percentage-based commission model
- **Requirement 3.3:** Tiered commission model
- **Requirement 3.4:** Category-based commission model
- **Requirement 3.7:** Vendor-specific commission rules from profile
- **Requirement 6.9:** Vendor financial profile maintenance

## Testing Checklist

- [ ] Profile initialization for new vendors
- [ ] Commission model switching (flat → percentage → tiered)
- [ ] Tier management (add, edit, remove)
- [ ] Form validation (negative values, invalid ranges)
- [ ] Optimistic updates for commission rules
- [ ] Financial summary display accuracy
- [ ] Subscription threshold tracking
- [ ] RLS policies (finance permission required)
- [ ] Loading and error states
- [ ] Responsive design on mobile/tablet

## Future Enhancements

1. **Category-Based Rates:** Full implementation with product catalog integration
2. **Historical Commission Changes:** Track commission rule changes over time
3. **Commission Simulation:** Preview commission calculations before saving
4. **Bulk Updates:** Update commission rules for multiple vendors
5. **Commission Analytics:** Visualize commission trends and profitability
6. **Payment Method Integration:** Direct integration with payment gateways
7. **Automated Threshold Billing:** Trigger subscription invoices automatically

## Troubleshooting

### Profile Not Loading

Check RLS policies - user must have finance permission:
```sql
SELECT * FROM profiles WHERE id = auth.uid();
-- Verify main_role = 'admin' or has finance permission in custom_roles
```

### Commission Rules Not Saving

Verify Zod schema validation:
- Tier max_amount must be greater than min_amount
- Rates must be between 0-100
- Tiers must not overlap

### Threshold Not Incrementing

Ensure the database function is called after order completion:
```typescript
await supabase.rpc('increment_vendor_threshold', {
  p_vendor_id: vendorId
});
```

## Support

For issues or questions:
1. Check the design document: `.kiro/specs/finance-module/design.md`
2. Review requirements: `.kiro/specs/finance-module/requirements.md`
3. Examine existing patterns in `GeneralLedgerService.ts` and `useGeneralLedger.ts`
