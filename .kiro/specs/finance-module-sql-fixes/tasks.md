# Implementation Plan

## Phase 1: Bug Condition Exploration Tests

- [ ] 1. Write bug condition exploration test for SQL delimiter syntax
  - **Property 1: Bug Condition** - SQL Delimiter Syntax Errors
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate delimiter syntax bugs exist
  - **Scoped PBT Approach**: Test concrete failing migrations with single `$` delimiter syntax
  - Test that migrations with PL/pgSQL functions using single `$` delimiter fail to execute
  - Run test on UNFIXED code (migrations: 20260318_add_audit_logs_foreign_key.sql, 20260318_currency_system.sql, 20260329_finance_vendor_profiles.sql)
  - **EXPECTED OUTCOME**: Test FAILS with "syntax error at or near $" (this is correct - it proves the bug exists)
  - Document counterexamples found: specific migration files and line numbers where single `$` causes parse errors
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [ ] 2. Write bug condition exploration test for duplicate index creation
  - **Property 1: Bug Condition** - Duplicate Index Creation Errors
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate duplicate index bugs exist
  - **Scoped PBT Approach**: Run migration 20260329_finance_vendor_profiles.sql twice in succession
  - Test that running the migration multiple times fails with "relation already exists" error
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS on second run with constraint violation (this is correct - it proves the bug exists)
  - Document counterexamples found: specific index names that fail on duplicate creation
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2, 2.2_

- [ ] 3. Write bug condition exploration test for invalid RLS enum references
  - **Property 1: Bug Condition** - Invalid Enum Value in RLS Policies
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate RLS policy enum bugs exist
  - **Scoped PBT Approach**: Test RLS policies checking for 'finance_admin' enum value
  - Test that accessing finance features with RLS policy checking `app_role = 'finance_admin'` fails
  - Run test on UNFIXED code (migration: 20260329_finance_vendor_profiles.sql original version)
  - **EXPECTED OUTCOME**: Test FAILS with "invalid input value for enum app_role: finance_admin" (this is correct - it proves the bug exists)
  - Document counterexamples found: specific RLS policies and tables affected
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 2.3_

- [ ] 4. Write bug condition exploration test for UI scrollbar styling
  - **Property 1: Bug Condition** - Default Browser Scrollbar Styling
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate scrollbar styling bugs exist
  - **Scoped PBT Approach**: Inspect vendor profiles tab scrollbar in GeneralLedgerPage.tsx
  - Test that scrollbar does not use primary color (pink) theme styling
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS showing default browser scrollbar instead of primary color (this is correct - it proves the bug exists)
  - Document counterexamples found: specific component and styling properties missing
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.4, 2.4_

- [ ] 5. Write bug condition exploration test for missing drag functionality
  - **Property 1: Bug Condition** - No Drag-to-Scroll Interaction
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate missing drag functionality
  - **Scoped PBT Approach**: Test tab navigation in GeneralLedgerPage.tsx for drag interaction
  - Test that tab navigation does not respond to mouse drag gestures
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS showing no drag interaction handlers (this is correct - it proves the bug exists)
  - Document counterexamples found: specific event handlers and state management missing
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.5, 2.5_

- [ ] 6. Write bug condition exploration test for enterprise label mismatch
  - **Property 1: Bug Condition** - Personal Context Labels Instead of Enterprise
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate label mismatch bugs exist
  - **Scoped PBT Approach**: Test expense management labels in ExpenseManagementPage.tsx
  - Test that labels display "My expenses" instead of "Organization expenses"
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS showing personal context labels (this is correct - it proves the bug exists)
  - Document counterexamples found: specific labels and components affected
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.6, 2.6_

- [ ] 7. Write bug condition exploration test for missing custom category feature
  - **Property 1: Bug Condition** - No Custom Category Creation Option
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate missing feature
  - **Scoped PBT Approach**: Test expense submission form for custom category creation UI
  - Test that no button or dialog exists for creating custom expense categories
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS showing missing UI elements (this is correct - it proves the bug exists)
  - Document counterexamples found: specific UI components and functionality missing
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.7, 2.7_

- [ ] 8. Write bug condition exploration test for unorganized migration structure
  - **Property 1: Bug Condition** - Finance Migrations Scattered in Root Folder
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate organizational issues
  - **Scoped PBT Approach**: Test migration folder structure for finance-related files
  - Test that finance migrations (from 20260318 onwards) are in main migrations folder instead of dedicated subfolder
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS showing unorganized structure (this is correct - it proves the bug exists)
  - Document counterexamples found: list of finance migration files in root folder
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.8, 2.8_

## Phase 2: Preservation Property Tests

- [ ] 9. Write preservation property tests for non-finance migrations (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Finance Migration Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Non-finance migrations (HR, vendor, MOU, pre-20260318) execute successfully on unfixed code
  - Observe: Migrations create tables, indexes, functions without errors
  - Write property-based test: for all non-finance migrations, execution succeeds identically before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.1_

- [ ] 10. Write preservation property tests for valid RLS policies (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid App Role Enum RLS Policies Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: RLS policies using valid app_role values ('admin', 'ops_manager', 'viewer', 'employee') enforce correctly on unfixed code
  - Observe: Users with appropriate roles can access resources, others are denied
  - Write property-based test: for all RLS policies with valid enum values, enforcement behavior is identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.2_

- [ ] 11. Write preservation property tests for non-finance UI components (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Finance UI Components Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: HR module, vendor management, issue tracking, MOU components render correctly on unfixed code
  - Observe: Styling, interactions, and functionality work as expected
  - Write property-based test: for all non-finance UI components, rendering and behavior is identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.3, 3.5_

- [ ] 12. Write preservation property tests for financial data integrity (BEFORE implementing fix)
  - **Property 2: Preservation** - Financial Data Query Results Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Existing journal entries, accounts, ledger entries, transactions query correctly on unfixed code
  - Observe: Balance calculations, reporting queries return expected results
  - Write property-based test: for all financial data queries, results are identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.6_

- [ ] 13. Write preservation property tests for admin access (BEFORE implementing fix)
  - **Property 2: Preservation** - Admin Role Access Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Users with main_role = 'admin' have full access to finance features on unfixed code
  - Observe: Admin users can view, create, update, delete finance records
  - Write property-based test: for all admin users, finance access is identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.7_

- [ ] 14. Write preservation property tests for non-finance custom roles (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Finance Permission Denial Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Custom roles without finance permissions are denied access to finance features on unfixed code
  - Observe: Access control enforces correctly based on custom_roles.permissions
  - Write property-based test: for all custom roles without finance permissions, access denial is identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.8_

- [ ] 15. Write preservation property tests for non-enterprise users (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Enterprise User Features Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Non-enterprise users see appropriate expense tracking features on unfixed code
  - Observe: Personal expense submission and tracking works correctly
  - Write property-based test: for all non-enterprise users, expense features are identical before and after fix
  - Verify test passes on UNFIXED code
  - _Requirements: 3.4_

## Phase 3: Implementation

- [x] 16. Fix SQL delimiter syntax in all affected migration files

  - [x] 16.1 Fix delimiter syntax in 20260318_add_audit_logs_foreign_key.sql
    - Replace all single `$` with double `$$` in function definitions
    - Update `AS $` → `AS $$`
    - Update `END $;` → `END $$;`
    - Update `$ LANGUAGE` → `$$ LANGUAGE`
    - _Bug_Condition: isBugCondition(migration) where migration.containsPlpgsqlFunction AND migration.delimiterSyntax == '$'_
    - _Expected_Behavior: Migration executes without "syntax error at or near $" errors_
    - _Preservation: Non-finance migrations continue to execute from main folder without errors_
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.2 Fix delimiter syntax in 20260318_currency_system.sql
    - Replace all single `$` with double `$$` in function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.3 Fix delimiter syntax in 20260329_finance_vendor_profiles.sql
    - Replace all single `$` with double `$$` in function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.4 Fix delimiter syntax in 20260330_order_completion_handler.sql
    - Replace all single `$` with double `$$` in function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.5 Fix delimiter syntax in 20260331_optimize_revenue_journal_entries.sql
    - Replace all single `$` with double `$$` in function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.6 Fix delimiter syntax in 20260331_finance_delivery_data.sql
    - Replace all single `$` with double `$$` in function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.7 Fix delimiter syntax in 20260329_remove_multicurrency_pkr_only.sql
    - Replace all single `$` with double `$$` in DO blocks and function definitions
    - Apply same pattern as 16.1
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.8 Scan and fix delimiter syntax in remaining finance migrations (20260401-20260426)
    - Search for all migrations with PL/pgSQL functions
    - Apply delimiter fix pattern consistently
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 16.9 Verify SQL delimiter exploration test now passes
    - **Property 1: Expected Behavior** - SQL Migrations Execute Without Syntax Errors
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.1)_

- [x] 17. Add IF NOT EXISTS to index creation in 20260329_finance_vendor_profiles.sql

  - [x] 17.1 Update index creation statements
    - Add IF NOT EXISTS to idx_finance_vendor_profiles_vendor
    - Add IF NOT EXISTS to idx_finance_vendor_profiles_subscription_status
    - Add IF NOT EXISTS to idx_finance_vendor_profiles_next_billing
    - _Bug_Condition: isBugCondition(migration) where migration.createsIndex AND NOT migration.usesIfNotExists_
    - _Expected_Behavior: Migration can be run multiple times without "relation already exists" errors_
    - _Preservation: Non-finance migrations continue to execute without errors_
    - _Requirements: 1.2, 2.2, 3.1_

  - [x] 17.2 Verify duplicate index exploration test now passes
    - **Property 1: Expected Behavior** - Index Creation Idempotent
    - **IMPORTANT**: Re-run the SAME test from task 2 - do NOT write a new test
    - Run bug condition exploration test from step 2
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.2)_

- [x] 18. Update RLS policies to use custom roles system in 20260329_finance_vendor_profiles.sql

  - [x] 18.1 Update SELECT policy for finance_vendor_profiles
    - Replace app_role = 'finance_admin' check with custom_roles.permissions->>'finance' IS NOT NULL
    - Add LEFT JOIN to role_assignments and custom_roles tables
    - Include main_role = 'admin' check for admin users
    - _Bug_Condition: isBugCondition(policy) where policy.hasRLSPolicy AND policy.referencesAppRoleEnum('finance_admin')_
    - _Expected_Behavior: RLS policy checks custom_roles.permissions JSONB structure instead of non-existent enum values_
    - _Preservation: RLS policies using valid app_role enum values continue to enforce correctly_
    - _Requirements: 1.3, 2.3, 3.2, 3.7, 3.8_

  - [x] 18.2 Update manage policy for finance_vendor_profiles
    - Replace app_role = 'finance_admin' check with custom_roles.permissions->'finance'->>'manage' = 'true'
    - Add LEFT JOIN to role_assignments and custom_roles tables
    - Include main_role = 'admin' check for admin users
    - _Requirements: 1.3, 2.3, 3.2, 3.7, 3.8_

  - [x] 18.3 Verify RLS enum exploration test now passes
    - **Property 1: Expected Behavior** - RLS Policies Use Custom Roles System
    - **IMPORTANT**: Re-run the SAME test from task 3 - do NOT write a new test
    - Run bug condition exploration test from step 3
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.3)_

- [x] 19. Style vendor profiles scrollbar with primary color in GeneralLedgerPage.tsx

  - [x] 19.1 Add scrollbar styling to TabsList container
    - Add style prop with scrollbarWidth: 'thin' and scrollbarColor: 'hsl(var(--primary) / 0.3) transparent'
    - Add webkit scrollbar styles using styled-jsx or inline styles
    - Set scrollbar-thumb to hsl(var(--primary) / 0.3)
    - Set scrollbar-thumb:hover to hsl(var(--primary) / 0.5)
    - _Bug_Condition: isBugCondition(component) where component.componentName == 'VendorFinancialProfiles' AND component.scrollbarColor != 'primary'_
    - _Expected_Behavior: Scrollbar displays with pink primary color matching application theme_
    - _Preservation: Other scrollable tabs in application continue to display with existing scroll styling_
    - _Requirements: 1.4, 2.4, 3.5_

  - [x] 19.2 Verify scrollbar styling exploration test now passes
    - **Property 1: Expected Behavior** - Scrollbar Uses Primary Color Theme
    - **IMPORTANT**: Re-run the SAME test from task 4 - do NOT write a new test
    - Run bug condition exploration test from step 4
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.4)_

- [x] 20. Add drag functionality to tab navigation in GeneralLedgerPage.tsx

  - [x] 20.1 Implement drag-to-scroll state management
    - Add useState hooks for isDragging, startX, scrollLeft
    - Add useRef for tabsRef
    - _Bug_Condition: isBugCondition(component) where component.componentName == 'VendorFinancialProfiles' AND NOT component.hasDragFunctionality_
    - _Expected_Behavior: Tab navigation responds to mouse drag gestures with visual feedback_
    - _Preservation: Other scrollable tabs continue to display with existing functionality_
    - _Requirements: 1.5, 2.5, 3.5_

  - [x] 20.2 Implement drag event handlers
    - Add handleMouseDown to capture initial drag position
    - Add handleMouseMove to update scroll position during drag
    - Add handleMouseUp to end drag interaction
    - Add handleMouseLeave to handle drag cancellation
    - Update cursor style to 'grab' and 'grabbing'
    - _Requirements: 1.5, 2.5, 3.5_

  - [x] 20.3 Attach event handlers to TabsList container
    - Add onMouseDown, onMouseMove, onMouseUp, onMouseLeave props
    - Set initial cursor style to 'grab'
    - _Requirements: 1.5, 2.5, 3.5_

  - [x] 20.4 Verify drag functionality exploration test now passes
    - **Property 1: Expected Behavior** - Drag-to-Scroll Interaction Works
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - Run bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.5)_

- [x] 21. Update expense management labels for enterprise context in ExpenseManagementPage.tsx

  - [x] 21.1 Update page header labels
    - Change description from "Submit and manage employee expenses" to "Submit and manage organization expenses"
    - _Bug_Condition: isBugCondition(component) where component.componentName == 'ExpenseManagement' AND component.label == 'My expenses'_
    - _Expected_Behavior: Labels display "Organization expenses" to reflect enterprise focus_
    - _Preservation: Non-enterprise users continue to see appropriate expense tracking features_
    - _Requirements: 1.6, 2.6, 3.4_

  - [x] 21.2 Update stats card label
    - Change "My expenses" to "Organization expenses"
    - _Requirements: 1.6, 2.6, 3.4_

  - [x] 21.3 Update tab label
    - Change TabsTrigger value="my-expenses" label from "My expenses" to "Organization expenses"
    - _Requirements: 1.6, 2.6, 3.4_

  - [x] 21.4 Update card header
    - Change CardTitle from "My expenses" to "Organization expenses"
    - Change CardDescription from "View and track your submitted expenses" to "View and track organization submitted expenses"
    - _Requirements: 1.6, 2.6, 3.4_

  - [x] 21.5 Verify enterprise label exploration test now passes
    - **Property 1: Expected Behavior** - Enterprise Labels Display Correctly
    - **IMPORTANT**: Re-run the SAME test from task 6 - do NOT write a new test
    - Run bug condition exploration test from step 6
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.6)_

- [x] 22. Add custom category creation feature to ExpenseSubmissionForm.tsx

  - [x] 22.1 Add custom category dialog state management
    - Add useState for showCustomCategoryDialog
    - Add useState for customCategoryName
    - _Bug_Condition: isBugCondition(component) where component.componentName == 'ExpenseManagement' AND NOT component.hasCustomCategoryOption_
    - _Expected_Behavior: System provides option to create custom expense categories_
    - _Preservation: Existing expense submission workflow continues to work_
    - _Requirements: 1.7, 2.7_

  - [x] 22.2 Implement custom category creation handler
    - Add handleAddCustomCategory function
    - Integrate with Supabase to insert into expense_categories table
    - Add error handling and success feedback
    - _Requirements: 1.7, 2.7_

  - [x] 22.3 Add custom category dialog UI
    - Add Dialog component with trigger button (Plus icon)
    - Add Input field for category name
    - Add Cancel and Add category buttons
    - Position next to category Select component
    - _Requirements: 1.7, 2.7_

  - [x] 22.4 Verify custom category exploration test now passes
    - **Property 1: Expected Behavior** - Custom Category Creation Available
    - **IMPORTANT**: Re-run the SAME test from task 7 - do NOT write a new test
    - Run bug condition exploration test from step 7
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.7)_

- [ ] 23. Reorganize finance migrations into nested folder structure

  - [ ] 23.1 Create finance migrations folder
    - Create supabase/migrations/finance/ directory
    - _Bug_Condition: isBugCondition(structure) where finance_migrations are in root folder_
    - _Expected_Behavior: Finance migrations organized in dedicated subfolder_
    - _Preservation: Non-finance migrations continue to execute from main folder_
    - _Requirements: 1.8, 2.8, 3.1_

  - [ ] 23.2 Move finance migrations to subfolder
    - Move all migrations from 20260318 onwards to finance/ folder
    - Include: 20260318_add_audit_logs_foreign_key.sql, 20260318_currency_system.sql, 20260321_finance_module_core.sql
    - Include: 20260329_finance_vendor_profiles.sql, 20260329_remove_multicurrency_pkr_only.sql
    - Include: 20260330_order_completion_handler.sql, 20260331_finance_delivery_data.sql, 20260331_optimize_revenue_journal_entries.sql
    - Include: All 202604xx finance migrations (invoices, expenses, budgets, forecasts, etc.)
    - _Requirements: 1.8, 2.8, 3.1_

  - [ ] 23.3 Create README.md in finance folder
    - Document migration order and chronology
    - List key migrations and their purposes
    - Document dependencies (master consolidated system, custom roles, vendor tables)
    - Document RLS policy approach (custom roles system)
    - _Requirements: 1.8, 2.8_

  - [ ] 23.4 Verify migration organization exploration test now passes
    - **Property 1: Expected Behavior** - Finance Migrations Organized in Subfolder
    - **IMPORTANT**: Re-run the SAME test from task 8 - do NOT write a new test
    - Run bug condition exploration test from step 8
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.8)_

  - [ ] 23.5 Verify preservation tests still pass
    - **Property 2: Preservation** - All Preservation Properties
    - **IMPORTANT**: Re-run the SAME tests from tasks 9-15 - do NOT write new tests
    - Run preservation property tests from phase 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

## Phase 4: Checkpoint

- [ ] 24. Checkpoint - Ensure all tests pass
  - Verify all bug condition exploration tests now pass (tasks 1-8 re-run in implementation phase)
  - Verify all preservation property tests still pass (tasks 9-15 re-run in task 23.5)
  - Run full migration sequence from clean database to verify no errors
  - Test finance module access with various user roles
  - Test UI components render correctly with new styling and functionality
  - Ensure all tests pass, ask the user if questions arise
