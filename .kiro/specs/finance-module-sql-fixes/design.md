# Finance Module SQL Fixes - Bugfix Design

## Overview

This bugfix addresses critical SQL migration errors and UI inconsistencies in the Finance Module that prevent proper deployment and functionality. The issues span multiple categories: PL/pgSQL delimiter syntax errors causing parse failures, duplicate index creation attempts, RLS policies referencing non-existent enum values, and UI styling/functionality gaps in the vendor profiles and expense management interfaces. The fix strategy involves systematic correction of SQL syntax across all affected migrations, updating RLS policies to use the custom roles system, enhancing UI components with proper styling and drag functionality, and reorganizing migrations into a structured folder hierarchy for better maintainability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when SQL migrations use incorrect delimiter syntax, attempt duplicate index creation, reference invalid enum values, or when UI components lack proper styling/functionality
- **Property (P)**: The desired behavior - migrations execute without syntax errors, indexes use IF NOT EXISTS, RLS policies check custom_roles.permissions, UI components display with proper theme styling and drag functionality
- **Preservation**: Existing functionality that must remain unchanged - non-finance migrations, valid RLS policies, other module UI components, existing financial data integrity
- **PL/pgSQL Delimiter**: The `$$` syntax used to delimit function bodies in PostgreSQL (single `$` causes parse errors)
- **RLS (Row Level Security)**: PostgreSQL security feature that restricts row access based on policies
- **Custom Roles System**: The 2-layer role system using `custom_roles` table with JSONB permissions instead of app_role enum
- **IF NOT EXISTS**: SQL clause that prevents errors when creating objects that may already exist
- **Drag Functionality**: Horizontal scrolling interaction using mouse drag for tab navigation
- **Primary Color**: The pink theme color defined as `hsl(var(--primary))` in the application

## Bug Details

### Bug Condition

The bug manifests when developers attempt to deploy finance module migrations or when users interact with finance UI components. The SQL migrations fail during execution due to syntax errors, and the UI displays with inconsistent styling and missing interactions.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SQLMigration OR UIComponent
  OUTPUT: boolean
  
  IF input.type == 'SQLMigration' THEN
    RETURN (input.containsPlpgsqlFunction AND input.delimiterSyntax == '$')
           OR (input.createsIndex AND NOT input.usesIfNotExists)
           OR (input.hasRLSPolicy AND input.referencesAppRoleEnum('finance_admin'))
  ELSE IF input.type == 'UIComponent' THEN
    RETURN (input.componentName == 'VendorFinancialProfiles' AND input.scrollbarColor != 'primary')
           OR (input.componentName == 'VendorFinancialProfiles' AND NOT input.hasDragFunctionality)
           OR (input.componentName == 'ExpenseManagement' AND input.label == 'My expenses')
           OR (input.componentName == 'ExpenseManagement' AND NOT input.hasCustomCategoryOption)
  END IF
END FUNCTION
```

### Examples

**SQL Delimiter Syntax Error:**
- File: `20260318_add_audit_logs_foreign_key.sql`
- Current: `DO $ BEGIN ... END $;` (single dollar sign)
- Error: "syntax error at or near $"
- Expected: `DO $$ BEGIN ... END $$;` (double dollar sign)

**Duplicate Index Creation:**
- File: `20260329_finance_vendor_profiles.sql`
- Current: `CREATE INDEX idx_finance_vendor_profiles_vendor ON finance_vendor_profiles(vendor_id);`
- Error: "relation idx_finance_vendor_profiles_vendor already exists"
- Expected: `CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_vendor ON finance_vendor_profiles(vendor_id);`

**Invalid Enum Reference in RLS Policy:**
- File: `20260329_finance_vendor_profiles.sql` (original version before fix)
- Current: RLS policy checks `p.app_role = 'finance_admin'`
- Error: "invalid input value for enum app_role: finance_admin"
- Expected: Check `cr.permissions->>'finance' IS NOT NULL` using custom_roles table

**UI Scrollbar Styling:**
- Component: `GeneralLedgerPage.tsx` vendor profiles tab
- Current: Default browser scrollbar styling
- Expected: Pink primary color scrollbar matching application theme

**Missing Drag Functionality:**
- Component: `GeneralLedgerPage.tsx` tab navigation
- Current: No drag-to-scroll interaction
- Expected: Horizontal drag scrolling with visual feedback

**Enterprise Label Mismatch:**
- Component: `ExpenseManagementPage.tsx`
- Current: "My expenses" label
- Expected: "Organization expenses" for enterprise context

**Missing Custom Category Option:**
- Component: `ExpenseManagementPage.tsx`
- Current: No option to create custom expense categories
- Expected: Button/interface to add custom categories


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-finance SQL migrations must continue to execute from the main migrations folder without errors
- RLS policies using valid app_role enum values ('admin', 'ops_manager', 'viewer', 'employee') must continue to enforce correctly
- Other module UI components (HR, Issues, MOUs, Vendors) must continue to display with existing styling and functionality
- Existing journal entries, accounts, ledger entries, and financial transactions must remain queryable without performance degradation
- Users with admin role must continue to have full access based on main_role = 'admin' checks
- Custom roles without finance permissions must continue to be denied access to finance features appropriately
- Non-enterprise users must continue to see appropriate expense tracking features
- Other scrollable tabs in the application (HR module tabs, etc.) must continue to display with their existing scroll styling

**Scope:**
All SQL migrations not related to finance (pre-20260318 and non-finance migrations after that date) should be completely unaffected by this fix. All UI components outside the finance module should maintain their current behavior. The fix must be surgical and targeted only to the identified issues.

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Inconsistent Delimiter Syntax**: Developers used single `$` delimiter syntax in some migrations (likely copy-pasted from different sources or IDEs that auto-format differently), while PostgreSQL requires `$$` for PL/pgSQL function bodies. This is a common mistake when migrating from other database systems or when using different SQL editors.

2. **Missing IF NOT EXISTS Clauses**: The migration `20260329_finance_vendor_profiles.sql` was likely run multiple times during development/testing, and the indexes were created without the IF NOT EXISTS clause. Subsequent runs fail because the indexes already exist.

3. **Outdated RLS Policy References**: The RLS policies were written before the custom roles system was fully implemented, referencing a planned `finance_admin` value in the app_role enum that was never added. The system evolved to use the custom_roles table with JSONB permissions instead.

4. **Default Browser Styling**: The vendor profiles tab scrollbar was not explicitly styled, so it defaults to browser-native scrollbar appearance, which doesn't match the application's pink primary color theme.

5. **Missing Drag Implementation**: The tab navigation was implemented with overflow scrolling but without the drag-to-scroll interaction pattern that enhances UX on desktop devices.

6. **Copy-Paste from Personal Context**: The expense management labels were copied from a personal expense tracking context ("My expenses") rather than being adapted for enterprise/organizational use ("Organization expenses").

7. **Incomplete Feature Implementation**: The custom expense category feature was planned but not implemented in the initial expense management rollout.

8. **Unorganized Migration Structure**: As the finance module grew, migrations accumulated in the main folder without a dedicated organizational structure, making it difficult to maintain and understand the finance module's evolution.

## Correctness Properties

Property 1: Bug Condition - SQL Migrations Execute Without Errors

_For any_ SQL migration file containing PL/pgSQL functions, index creation statements, or RLS policies, the fixed migrations SHALL use correct `$$` delimiter syntax, include IF NOT EXISTS clauses for index creation, and reference the custom_roles.permissions JSONB structure instead of non-existent app_role enum values, allowing migrations to execute successfully without parse errors or constraint violations.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Finance Functionality Unchanged

_For any_ SQL migration not related to finance, RLS policy using valid app_role values, UI component outside the finance module, or existing financial data query, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for non-finance operations, valid role checks, other module UIs, and data integrity.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the following changes are required:

**Category 1: SQL Delimiter Syntax Fixes**

**Files Affected:**
- `supabase/migrations/20260318_add_audit_logs_foreign_key.sql`
- `supabase/migrations/20260318_currency_system.sql`
- `supabase/migrations/20260329_finance_vendor_profiles.sql`
- `supabase/migrations/20260330_order_completion_handler.sql`
- `supabase/migrations/20260331_optimize_revenue_journal_entries.sql`
- `supabase/migrations/20260402_revenue_event_handler_enhancements.sql`
- `supabase/migrations/20260404_subscription_billing_automation.sql`
- All other finance migrations containing PL/pgSQL functions (20260321 onwards)

**Specific Changes:**
1. **Replace all single `$` delimiters with `$$`**:
   - Find: `AS $` → Replace: `AS $$`
   - Find: `END $;` → Replace: `END $$;`
   - Find: `$ LANGUAGE` → Replace: `$$ LANGUAGE`
   - Apply to all function definitions, DO blocks, and trigger definitions

**Example Fix:**
```sql
-- BEFORE (incorrect)
CREATE OR REPLACE FUNCTION update_finance_accounts_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- AFTER (correct)
CREATE OR REPLACE FUNCTION update_finance_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Category 2: Index Creation IF NOT EXISTS**

**File**: `supabase/migrations/20260329_finance_vendor_profiles.sql`

**Specific Changes:**
1. **Add IF NOT EXISTS to all CREATE INDEX statements**:
   ```sql
   -- BEFORE
   CREATE INDEX idx_finance_vendor_profiles_vendor ON finance_vendor_profiles(vendor_id);
   CREATE INDEX idx_finance_vendor_profiles_subscription_status ON finance_vendor_profiles(subscription_status);
   CREATE INDEX idx_finance_vendor_profiles_next_billing ON finance_vendor_profiles(next_billing_date);
   
   -- AFTER
   CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_vendor ON finance_vendor_profiles(vendor_id);
   CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_subscription_status ON finance_vendor_profiles(subscription_status);
   CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_next_billing ON finance_vendor_profiles(next_billing_date);
   ```

**Category 3: RLS Policy Custom Roles Integration**

**File**: `supabase/migrations/20260329_finance_vendor_profiles.sql`

**Specific Changes:**
1. **Update RLS policies to use custom_roles.permissions JSONB**:
   ```sql
   -- BEFORE (references non-existent enum value)
   CREATE POLICY "Users with finance permission can view vendor profiles"
     ON finance_vendor_profiles
     FOR SELECT
     USING (
       EXISTS (
         SELECT 1 FROM profiles p
         WHERE p.id = auth.uid() AND p.app_role = 'finance_admin'
       )
     );
   
   -- AFTER (uses custom roles system)
   CREATE POLICY "Users with finance permission can view vendor profiles"
     ON finance_vendor_profiles
     FOR SELECT
     USING (
       EXISTS (
         SELECT 1 FROM profiles p
         LEFT JOIN role_assignments ra ON ra.user_id = p.id
         LEFT JOIN custom_roles cr ON cr.id = ra.role_id
         WHERE p.id = auth.uid()
           AND (
             p.main_role = 'admin'
             OR cr.permissions->>'finance' IS NOT NULL
           )
       )
     );
   ```

2. **Apply same pattern to manage policy**:
   ```sql
   CREATE POLICY "Users with finance manage permission can manage vendor profiles"
     ON finance_vendor_profiles
     FOR ALL
     USING (
       EXISTS (
         SELECT 1 FROM profiles p
         LEFT JOIN role_assignments ra ON ra.user_id = p.id
         LEFT JOIN custom_roles cr ON cr.id = ra.role_id
         WHERE p.id = auth.uid()
           AND (
             p.main_role = 'admin'
             OR (cr.permissions->'finance'->>'manage' = 'true')
           )
       )
     );
   ```

**Category 4: Vendor Profiles Scrollbar Styling**

**File**: `src/components/finance/GeneralLedgerPage.tsx`

**Specific Changes:**
1. **Update scrollbar styling in the vendors tab section**:
   ```tsx
   // Find the TabsList container div with overflow-x-auto
   // Update the style prop to include primary color scrollbar
   
   <div 
     ref={tabsRef}
     className="overflow-x-auto overflow-y-hidden group"
     style={{ 
       WebkitOverflowScrolling: 'touch',
       scrollbarWidth: 'thin',
       scrollbarColor: 'hsl(var(--primary) / 0.3) transparent'  // PRIMARY COLOR
     }}
   >
     <style jsx>{`
       div::-webkit-scrollbar {
         height: 6px;
       }
       div::-webkit-scrollbar-track {
         background: transparent;
       }
       div::-webkit-scrollbar-thumb {
         background: hsl(var(--primary) / 0.3);  // PRIMARY COLOR
         border-radius: 10px;
       }
       div::-webkit-scrollbar-thumb:hover {
         background: hsl(var(--primary) / 0.5);  // PRIMARY COLOR HOVER
       }
     `}</style>
   </div>
   ```


**Category 5: Drag Functionality for Tab Navigation**

**File**: `src/components/finance/GeneralLedgerPage.tsx`

**Specific Changes:**
1. **Add drag-to-scroll functionality using mouse events**:
   ```tsx
   import { useState, useRef } from "react";
   
   export function GeneralLedgerPage({ onTabChange }: GeneralLedgerPageProps) {
     const [activeTab, setActiveTab] = useState("entries");
     const tabsRef = useRef<HTMLDivElement>(null);
     const [isDragging, setIsDragging] = useState(false);
     const [startX, setStartX] = useState(0);
     const [scrollLeft, setScrollLeft] = useState(0);
     
     const handleMouseDown = (e: React.MouseEvent) => {
       if (!tabsRef.current) return;
       setIsDragging(true);
       setStartX(e.pageX - tabsRef.current.offsetLeft);
       setScrollLeft(tabsRef.current.scrollLeft);
       tabsRef.current.style.cursor = 'grabbing';
     };
     
     const handleMouseLeave = () => {
       setIsDragging(false);
       if (tabsRef.current) {
         tabsRef.current.style.cursor = 'grab';
       }
     };
     
     const handleMouseUp = () => {
       setIsDragging(false);
       if (tabsRef.current) {
         tabsRef.current.style.cursor = 'grab';
       }
     };
     
     const handleMouseMove = (e: React.MouseEvent) => {
       if (!isDragging || !tabsRef.current) return;
       e.preventDefault();
       const x = e.pageX - tabsRef.current.offsetLeft;
       const walk = (x - startX) * 2; // Scroll speed multiplier
       tabsRef.current.scrollLeft = scrollLeft - walk;
     };
     
     return (
       <div className="space-y-6">
         {/* ... */}
         <div 
           ref={tabsRef}
           className="overflow-x-auto overflow-y-hidden group"
           style={{ 
             WebkitOverflowScrolling: 'touch',
             scrollbarWidth: 'thin',
             scrollbarColor: 'hsl(var(--primary) / 0.3) transparent',
             cursor: 'grab'
           }}
           onMouseDown={handleMouseDown}
           onMouseLeave={handleMouseLeave}
           onMouseUp={handleMouseUp}
           onMouseMove={handleMouseMove}
         >
           {/* TabsList content */}
         </div>
       </div>
     );
   }
   ```

**Category 6: Enterprise Expense Management Labels**

**File**: `src/components/finance/ExpenseManagementPage.tsx`

**Specific Changes:**
1. **Update page header label**:
   ```tsx
   // BEFORE
   <h1 className="text-3xl font-bold">Expense management</h1>
   <p className="text-muted-foreground mt-1">
     Submit and manage employee expenses
   </p>
   
   // AFTER
   <h1 className="text-3xl font-bold">Expense management</h1>
   <p className="text-muted-foreground mt-1">
     Submit and manage organization expenses
   </p>
   ```

2. **Update stats card label**:
   ```tsx
   // BEFORE
   <p className="text-sm text-muted-foreground">My expenses</p>
   
   // AFTER
   <p className="text-sm text-muted-foreground">Organization expenses</p>
   ```

3. **Update tab label**:
   ```tsx
   // BEFORE
   <TabsTrigger value="my-expenses">My expenses</TabsTrigger>
   
   // AFTER
   <TabsTrigger value="my-expenses">Organization expenses</TabsTrigger>
   ```

4. **Update card header**:
   ```tsx
   // BEFORE
   <CardTitle>My expenses</CardTitle>
   <CardDescription>
     View and track your submitted expenses
   </CardDescription>
   
   // AFTER
   <CardTitle>Organization expenses</CardTitle>
   <CardDescription>
     View and track organization submitted expenses
   </CardDescription>
   ```

**Category 7: Custom Expense Categories**

**File**: `src/components/finance/ExpenseSubmissionForm.tsx`

**Specific Changes:**
1. **Add custom category creation button and dialog**:
   ```tsx
   import { useState } from "react";
   import { Plus } from "lucide-react";
   import { Button } from "@/components/ui/button";
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogFooter,
     DialogHeader,
     DialogTitle,
     DialogTrigger,
   } from "@/components/ui/dialog";
   import { Input } from "@/components/ui/input";
   import { Label } from "@/components/ui/label";
   
   export function ExpenseSubmissionForm() {
     const [showCustomCategoryDialog, setShowCustomCategoryDialog] = useState(false);
     const [customCategoryName, setCustomCategoryName] = useState("");
     
     const handleAddCustomCategory = () => {
       // Logic to add custom category to database
       // This would call a Supabase function to insert into expense_categories table
       console.log("Adding custom category:", customCategoryName);
       setShowCustomCategoryDialog(false);
       setCustomCategoryName("");
     };
     
     return (
       <Card>
         <CardContent>
           {/* Existing form fields */}
           
           <div className="space-y-2">
             <Label htmlFor="category">Category</Label>
             <div className="flex gap-2">
               <Select>
                 {/* Existing category options */}
               </Select>
               <Dialog open={showCustomCategoryDialog} onOpenChange={setShowCustomCategoryDialog}>
                 <DialogTrigger asChild>
                   <Button variant="outline" size="icon">
                     <Plus className="w-4 h-4" />
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Add custom category</DialogTitle>
                     <DialogDescription>
                       Create a new expense category for your organization
                     </DialogDescription>
                   </DialogHeader>
                   <div className="space-y-4">
                     <div className="space-y-2">
                       <Label htmlFor="category-name">Category name</Label>
                       <Input
                         id="category-name"
                         value={customCategoryName}
                         onChange={(e) => setCustomCategoryName(e.target.value)}
                         placeholder="Enter category name"
                       />
                     </div>
                   </div>
                   <DialogFooter>
                     <Button variant="outline" onClick={() => setShowCustomCategoryDialog(false)}>
                       Cancel
                     </Button>
                     <Button onClick={handleAddCustomCategory}>
                       Add category
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             </div>
           </div>
         </CardContent>
       </Card>
     );
   }
   ```

**Category 8: Migration Folder Reorganization**

**Approach**: Create a nested folder structure for finance migrations while maintaining backward compatibility.

**Specific Changes:**
1. **Create finance migrations folder structure**:
   ```
   supabase/migrations/
   ├── finance/
   │   ├── 20260318_add_audit_logs_foreign_key.sql
   │   ├── 20260318_currency_system.sql
   │   ├── 20260321_finance_module_core.sql
   │   ├── 20260329_finance_vendor_profiles.sql
   │   ├── 20260329_remove_multicurrency_pkr_only.sql
   │   ├── 20260330_order_completion_handler.sql
   │   ├── 20260331_finance_delivery_data.sql
   │   ├── 20260331_optimize_revenue_journal_entries.sql
   │   ├── 20260401_finance_invoices.sql
   │   ├── 20260401_finance_order_data.sql
   │   ├── 20260402_revenue_event_handler_enhancements.sql
   │   ├── 20260403_finance_invoices.sql
   │   ├── 20260404_finance_expenses.sql
   │   ├── 20260404_subscription_billing_automation.sql
   │   ├── 20260405_finance_order_data.sql
   │   ├── 20260405_finance_receipt_vault.sql
   │   ├── 20260405_receipt_storage_bucket.sql
   │   ├── 20260406_finance_budgets.sql
   │   ├── 20260406_finance_expenses.sql
   │   ├── 20260407_finance_modeling_workspace.sql
   │   ├── 20260408_finance_forecasts.sql
   │   ├── 20260409_finance_anomalies.sql
   │   ├── 20260410_finance_exchange_rates.sql
   │   ├── 20260410_finance_fx_transactions.sql
   │   ├── 20260420_bank_reconciliation.sql
   │   ├── 20260421_fx_transactions.sql
   │   ├── 20260422_tax_system.sql
   │   ├── 20260426_finance_rls_policies.sql
   │   └── README.md
   └── [other migrations remain in root]
   ```

2. **Create README.md in finance folder**:
   ```markdown
   # Finance Module Migrations
   
   This folder contains all SQL migrations related to the Finance Module.
   
   ## Migration Order
   
   Migrations are applied in chronological order by filename timestamp.
   
   ## Key Migrations
   
   - `20260318_currency_system.sql` - Multi-currency support foundation
   - `20260321_finance_module_core.sql` - Core finance tables (accounts, journal entries, ledger)
   - `20260329_finance_vendor_profiles.sql` - Vendor financial profiles and commission tracking
   - `20260330_order_completion_handler.sql` - Revenue event handling from delivery module
   - `20260331_optimize_revenue_journal_entries.sql` - Performance optimization for journal entries
   - `20260404_subscription_billing_automation.sql` - Automated billing cycles
   - `20260405_finance_receipt_vault.sql` - Receipt storage and categorization
   - `20260422_tax_system.sql` - Tax reporting and compliance
   
   ## Dependencies
   
   Finance migrations depend on:
   - Master consolidated system migration (20260320_master_consolidated_system.sql)
   - Custom roles system (role_assignments, custom_roles tables)
   - Vendor management tables (vendors table)
   
   ## RLS Policies
   
   All finance tables use Row Level Security with the custom roles system.
   Finance permissions are stored in `custom_roles.permissions->>'finance'`.
   ```

3. **Update Supabase configuration** (if needed):
   - Supabase CLI automatically detects migrations in subdirectories
   - No configuration changes required for nested folder structure
   - Migrations are still applied in chronological order by filename


## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify that the bugs exist in the current code by attempting to run migrations and interact with UI components, then verify that the fixes resolve all issues without introducing regressions.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Attempt to run the unfixed migrations in a test database environment and interact with the unfixed UI components to observe failures and understand the root causes.

**Test Cases**:
1. **SQL Delimiter Syntax Test**: Run migration `20260318_add_audit_logs_foreign_key.sql` with single `$` delimiter (will fail with "syntax error at or near $")
2. **Duplicate Index Test**: Run migration `20260329_finance_vendor_profiles.sql` twice in succession (will fail on second run with "relation already exists")
3. **Invalid Enum Test**: Attempt to access finance features with RLS policy checking `app_role = 'finance_admin'` (will fail with "invalid input value for enum")
4. **Scrollbar Styling Test**: Inspect vendor profiles tab scrollbar in browser DevTools (will show default browser styling, not primary color)
5. **Drag Functionality Test**: Attempt to drag-scroll the tab navigation (will not respond to drag gestures)
6. **Enterprise Label Test**: View expense management page (will display "My expenses" instead of "Organization expenses")
7. **Custom Category Test**: Look for custom category creation option in expense form (will not find any button or interface)
8. **Migration Organization Test**: Navigate migrations folder (will find finance migrations scattered in root folder)

**Expected Counterexamples**:
- PostgreSQL parse errors with single `$` delimiter syntax
- Constraint violation errors on duplicate index creation
- Enum validation errors on RLS policy execution
- Browser default scrollbar styling instead of primary color
- No drag interaction response on tab navigation
- Personal context labels instead of enterprise labels
- Missing UI elements for custom category creation
- Unorganized migration file structure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL migration WHERE containsPlpgsqlFunction(migration) DO
  result := executeMigration_fixed(migration)
  ASSERT result.success = true AND result.errors = []
END FOR

FOR ALL index_creation WHERE inMigration(index_creation) DO
  result := executeMigration_fixed(migration)
  ASSERT result.success = true EVEN IF runMultipleTimes
END FOR

FOR ALL rls_policy WHERE checksFinancePermission(rls_policy) DO
  result := executeQuery_fixed(rls_policy, user_with_finance_permission)
  ASSERT result.access_granted = true
END FOR

FOR ALL ui_component WHERE isFinanceComponent(ui_component) DO
  result := renderComponent_fixed(ui_component)
  ASSERT result.styling = expected_styling
  ASSERT result.functionality = expected_functionality
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL migration WHERE NOT isFinanceMigration(migration) DO
  ASSERT executeMigration_original(migration) = executeMigration_fixed(migration)
END FOR

FOR ALL rls_policy WHERE usesValidAppRoleEnum(rls_policy) DO
  ASSERT executeQuery_original(rls_policy) = executeQuery_fixed(rls_policy)
END FOR

FOR ALL ui_component WHERE NOT isFinanceComponent(ui_component) DO
  ASSERT renderComponent_original(ui_component) = renderComponent_fixed(ui_component)
END FOR

FOR ALL financial_data WHERE existsInDatabase(financial_data) DO
  ASSERT queryData_original(financial_data) = queryData_fixed(financial_data)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Execute non-finance migrations, test non-finance RLS policies, render non-finance UI components, and query existing financial data on both unfixed and fixed code to verify identical behavior.

**Test Cases**:
1. **Non-Finance Migration Preservation**: Execute HR, vendor, MOU, and other non-finance migrations on fixed codebase (should execute identically to original)
2. **Valid RLS Policy Preservation**: Test RLS policies using valid app_role enum values ('admin', 'ops_manager', 'viewer', 'employee') on fixed codebase (should enforce identically to original)
3. **Non-Finance UI Preservation**: Render HR module, vendor management, issue tracking, and MOU components on fixed codebase (should display identically to original)
4. **Financial Data Integrity Preservation**: Query journal entries, accounts, ledger entries, and transactions on fixed codebase (should return identical results to original)
5. **Admin Access Preservation**: Test admin user access to finance features on fixed codebase (should grant full access identically to original)
6. **Non-Finance Permission Preservation**: Test custom roles without finance permissions attempting to access finance features on fixed codebase (should deny access identically to original)
7. **Non-Enterprise User Preservation**: Test non-enterprise users accessing expense management on fixed codebase (should display appropriate features identically to original)
8. **Other Module Scrollbar Preservation**: Test scrollbar styling on HR module tabs and other scrollable components on fixed codebase (should display with existing styling identically to original)

### Unit Tests

**SQL Migration Tests:**
- Test each fixed migration file executes without syntax errors
- Test migrations can be run multiple times without constraint violations (idempotency)
- Test RLS policies grant access to users with appropriate custom_roles permissions
- Test RLS policies deny access to users without appropriate permissions
- Test function definitions use correct `$$` delimiter syntax
- Test index creation uses IF NOT EXISTS clause

**UI Component Tests:**
- Test vendor profiles tab scrollbar displays with primary color styling
- Test tab navigation responds to drag gestures with proper cursor feedback
- Test expense management displays "Organization expenses" labels
- Test custom category dialog opens and closes correctly
- Test custom category creation submits to database
- Test drag-to-scroll functionality works across different screen sizes

**Integration Tests:**
- Test complete migration sequence from clean database to fully migrated state
- Test finance module access with various user roles and custom permissions
- Test expense submission workflow with custom categories
- Test tab navigation drag functionality with keyboard navigation fallback

### Property-Based Tests

**SQL Migration Properties:**
- Generate random valid SQL function definitions and verify they execute with `$$` delimiter
- Generate random index creation statements and verify they succeed with IF NOT EXISTS
- Generate random user permission combinations and verify RLS policies enforce correctly

**UI Component Properties:**
- Generate random tab configurations and verify drag functionality works consistently
- Generate random expense categories and verify custom category creation works
- Generate random user roles and verify appropriate labels display

**Data Integrity Properties:**
- Generate random financial transactions and verify they remain queryable after fixes
- Generate random journal entries and verify balances remain correct after fixes
- Generate random account queries and verify results remain consistent after fixes

### Integration Tests

**End-to-End Migration Test:**
1. Start with clean database
2. Apply all migrations in chronological order (including fixed finance migrations)
3. Verify all tables, functions, indexes, and RLS policies exist
4. Verify no errors or warnings in migration logs
5. Verify finance module is accessible to users with appropriate permissions

**End-to-End UI Test:**
1. Log in as user with finance permissions
2. Navigate to finance module
3. Verify vendor profiles tab displays with primary color scrollbar
4. Verify tab navigation responds to drag gestures
5. Navigate to expense management
6. Verify "Organization expenses" labels display
7. Verify custom category creation dialog opens
8. Submit expense with custom category
9. Verify expense appears in organization expenses list

**Cross-Module Integration Test:**
1. Test finance module access from dashboard
2. Test vendor financial profile access from vendor detail page
3. Test expense submission from employee self-service
4. Test financial reporting access from analytics module
5. Verify all integrations work correctly after fixes

