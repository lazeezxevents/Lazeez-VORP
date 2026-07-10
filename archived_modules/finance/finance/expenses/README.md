# Expense Management System

Complete implementation of the expense management system with approval workflows, policy validation, and UI components.

## Tasks Completed

### Task 18.3: Approval Workflow Routing ✅
**File**: `ExpenseApprovalWorkflow.ts`

- Routes expenses through configured approval chains based on amount
- Notifies approvers of pending expenses via notifications system
- Tracks approval history in expense records
- Supports multi-level approval chains (manager → finance manager → finance admin)
- Handles policy violation escalation

**Requirements**: 9.3, 9.4

### Task 18.4: Expense Policy Validation ✅
**File**: `ExpensePolicyValidator.ts`

- Validates expense amounts against policy limits per category
- Checks required receipt attachments based on thresholds
- Detects duplicate submissions (same amount, date, category)
- Flags policy violations with severity levels
- Validates expense dates (no future dates)
- Validates categories against allowed list

**Requirements**: 9.7, 22.1, 22.2, 22.6

### Task 18.5: Expense Submission Form ✅
**File**: `ExpenseSubmissionForm.tsx`

- Category, amount, date, description fields with validation
- Receipt upload with drag-and-drop support
- Receipt preview for images
- Real-time policy limit warnings
- Optimistic UI updates
- Framer Motion animations (staggered entry, hover effects)
- Follows design system (sentence case, proper colors, accessibility)

**Requirements**: 9.1, 9.2

### Task 18.6: Expense Approval Interface ✅
**File**: `ExpenseApprovalInterface.tsx`

- Shows pending expenses for current approver
- Displays full expense details with employee info
- Shows receipt attachments
- Approve/reject actions with notes/reasons
- Policy violation warnings
- Framer Motion animations
- Loading and empty states
- Keyboard accessible

**Requirements**: 9.5, 9.6

## Additional Components

### TanStack Query Hook ✅
**File**: `useExpenses.ts`

- `useExpenses()` - Fetch all expenses (admin view)
- `useMyExpenses()` - Fetch current user's expenses
- `usePendingApprovals()` - Fetch expenses pending approval
- `useExpense(id)` - Fetch single expense
- `useSubmitExpense()` - Submit expense mutation
- `useApproveExpense()` - Approve expense mutation
- `useRejectExpense()` - Reject expense mutation
- `useProcessReimbursement()` - Process reimbursement mutation

### Comprehensive Management Page ✅
**File**: `ExpenseManagementPage.tsx`

- Combined interface for submission and approval
- Stats cards showing expense counts
- Tabbed interface (My expenses, Approvals)
- Integrates submission form and approval interface

### Service Integration ✅
**File**: `ExpenseManagerService.ts` (updated)

- Integrated policy validation into submission flow
- Stores policy violations in expense records
- Enhanced audit logging with violation details

## Design System Compliance

All components follow the design system guidelines:

✅ **Typography**: Sentence case for UI text, no ALL CAPS
✅ **Animations**: Framer Motion for all interactions
✅ **Colors**: Semantic color variables (success, warning, error)
✅ **Hover States**: Lift effects on cards, scale on buttons
✅ **Loading States**: Skeleton components
✅ **Empty States**: Icons with helpful messages
✅ **Accessibility**: Keyboard navigation, semantic HTML, ARIA labels

## Usage Example

```tsx
import { ExpenseManagementPage } from "@/components/finance/ExpenseManagementPage";

// In your route/page component
function ExpensesPage() {
  return <ExpenseManagementPage />;
}
```

Or use individual components:

```tsx
import { 
  ExpenseSubmissionForm, 
  ExpenseApprovalInterface 
} from "@/components/finance/expenses";

// Submission form only
<ExpenseSubmissionForm />

// Approval interface only
<ExpenseApprovalInterface />
```

## Policy Configuration

Default policy limits are configured in `ExpensePolicyValidator.ts`:

- **Travel**: ₨50,000 max, receipt required over ₨5,000
- **Meals**: ₨10,000 max, receipt required over ₨2,000
- **Supplies**: ₨25,000 max, receipt required over ₨5,000
- **Technology**: ₨100,000 max, receipt required over ₨10,000
- **Marketing**: ₨75,000 max, receipt required over ₨10,000
- **Training**: ₨50,000 max, receipt required over ₨5,000
- **Entertainment**: ₨15,000 max, receipt required over ₨3,000
- **Other**: ₨20,000 max, receipt required over ₨5,000

## Approval Chain Configuration

Approval chains are configured in `ExpenseApprovalWorkflow.ts`:

- **₨0 - ₨10,000**: Manager approval
- **₨10,001 - ₨50,000**: Manager or Finance Manager
- **₨50,001 - ₨100,000**: Finance Manager
- **₨100,001+**: Finance Admin (requires multiple approvals)
- **Policy Violations**: Escalated to Finance Admin

## Features

### Expense Submission
- ✅ Multi-category support
- ✅ Receipt upload (images and PDFs)
- ✅ Drag-and-drop file upload
- ✅ Real-time policy validation
- ✅ Policy limit warnings
- ✅ Duplicate detection
- ✅ Optimistic UI updates

### Approval Workflow
- ✅ Automatic routing based on amount
- ✅ Multi-level approval chains
- ✅ Email notifications to approvers
- ✅ Approval history tracking
- ✅ Rejection with required reason
- ✅ Optional approval notes

### Policy Validation
- ✅ Amount limits per category
- ✅ Receipt requirements
- ✅ Duplicate detection
- ✅ Future date prevention
- ✅ Category validation
- ✅ Violation flagging

### UI/UX
- ✅ Framer Motion animations
- ✅ Responsive design
- ✅ Loading states
- ✅ Empty states
- ✅ Error handling
- ✅ Toast notifications
- ✅ Keyboard accessible

## Database Schema

The system uses the `finance_expenses` table created in migration `20260406_finance_expenses.sql`:

```sql
CREATE TABLE finance_expenses (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id),
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'PKR',
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_vault_id UUID,
  status TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  reimbursed_at TIMESTAMPTZ,
  reimbursement_transaction_id UUID,
  project_id UUID,
  vendor_id UUID,
  policy_violation_flags JSONB,
  approval_chain JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Integration Points

- **General Ledger**: Reimbursements create journal entries
- **Audit Logs**: All actions logged for compliance
- **Notifications**: Approvers notified of pending expenses
- **Receipt Vault**: Receipts stored in Supabase Storage
- **User Profiles**: Employee and approver information

## Next Steps

To integrate into the Finance module:

1. Add route to `src/pages/Finance.tsx` or create `src/pages/Expenses.tsx`
2. Add navigation link in sidebar
3. Configure Supabase Storage bucket for receipts
4. Set up email templates for notifications
5. Configure approval chains per organization
6. Customize policy limits per organization

## Testing

The implementation is ready for:
- Unit tests for validation logic
- Integration tests for approval workflow
- E2E tests for submission and approval flows
- Property-based tests for policy validation

## Performance

- Optimistic UI updates for instant feedback
- TanStack Query caching for fast data access
- Debounced validation checks
- Lazy loading of receipt images
- Efficient database queries with indexes
