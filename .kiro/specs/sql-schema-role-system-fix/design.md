# SQL Schema Role System Fix - Bugfix Design

## Overview

The Finance Module migration fails because it depends on the 2-layer role system tables (`role_assignments`, `custom_roles`) that are created by the master consolidated migration. The fix ensures proper migration dependency verification, idempotent execution, and validation of the role system schema before applying dependent migrations.

The solution implements a pre-flight check system that verifies the existence of required tables and provides clear error messages with remediation steps. This prevents partial migrations and ensures database consistency.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when Finance Module migration is executed before master migration, causing `role_assignments` table reference to fail
- **Property (P)**: The desired behavior - migrations execute in correct order with dependency verification, or fail fast with clear error messages
- **Preservation**: Existing idempotent behavior of master migration and all other module migrations must remain unchanged
- **Master Migration**: `20260320_master_consolidated_system.sql` - Creates the 2-layer role system (Layer 1: main_role, Layer 2: custom_roles + role_assignments)
- **Finance Migration**: `20260321_finance_module_core.sql` - Creates finance tables with RLS policies that depend on role system
- **Dependency Chain**: Master migration → Finance migration (and any future migrations that use role system)
- **Idempotent**: Migration can be run multiple times safely without errors or data corruption
- **RLS Policy**: Row Level Security policy that controls data access based on user roles and permissions

## Bug Details

### Fault Condition

The bug manifests when the Finance Module migration is executed before the master consolidated migration has created the role system tables. The RLS policies in the Finance Module reference `role_assignments` and `custom_roles` tables in their policy definitions, causing PostgreSQL to fail with "relation does not exist" errors.

**Formal Specification:**
```
FUNCTION isBugCondition(migrationState)
  INPUT: migrationState of type DatabaseMigrationState
  OUTPUT: boolean
  
  RETURN migrationState.currentMigration = 'finance_module_core'
         AND NOT tableExists('role_assignments')
         AND NOT tableExists('custom_roles')
         AND NOT tableExists('employee_invitations')
         AND migrationState.attemptingToCreateRLSPolicy = true
END FUNCTION
```

### Examples

- **Example 1**: Fresh database → Apply Finance migration first → ERROR: relation "role_assignments" does not exist at line 87 (first RLS policy creation)
- **Example 2**: Database with partial master migration (only profiles columns added) → Apply Finance migration → ERROR: relation "role_assignments" does not exist
- **Example 3**: Database with master migration applied → Apply Finance migration → SUCCESS: All tables and policies created correctly
- **Edge case**: Database with role_assignments table but missing custom_roles → Finance migration fails on policy that joins both tables → ERROR: relation "custom_roles" does not exist

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Master migration idempotency must continue to work (can be run multiple times safely)
- Existing RLS policies in other modules (vendors, issues, MOUs, HR) must continue to function
- Notification triggers and helper functions must continue to work correctly
- Finance Module table creation and seed data insertion must remain unchanged
- All existing migrations must continue to execute successfully when run in correct order

**Scope:**
All migrations that do NOT depend on the role system tables should be completely unaffected by this fix. This includes:
- Vendor management migrations
- Issue tracking migrations
- MOU management migrations
- HR module migrations (that don't reference role_assignments)
- Notification system migrations
- Any other independent module migrations

## Hypothesized Root Cause

Based on the bug description and migration analysis, the root causes are:

1. **Missing Dependency Verification**: The Finance Module migration does not check for the existence of required role system tables before attempting to create RLS policies that reference them
   - No pre-flight validation of table existence
   - No clear error message indicating missing dependencies
   - Migration proceeds blindly assuming dependencies are met

2. **Implicit Dependency Chain**: The dependency between master migration and Finance migration is implicit (based on file naming/timestamps) rather than explicit (verified at runtime)
   - Relies on developer discipline to apply migrations in order
   - No enforcement mechanism in the migration itself
   - Easy to miss dependency when applying migrations manually

3. **RLS Policy Compilation Timing**: PostgreSQL compiles RLS policies at creation time, not at execution time, so missing tables cause immediate failure
   - Policy definitions reference tables that must exist at policy creation
   - No deferred validation or lazy compilation
   - Failure occurs during DDL execution, not DML execution

4. **Lack of Migration State Tracking**: No centralized tracking of which migrations have been applied and their dependencies
   - Supabase CLI tracks migrations by filename/timestamp only
   - No dependency graph or prerequisite checking
   - Manual verification required for complex dependency chains

## Correctness Properties

Property 1: Fault Condition - Migration Dependency Verification

_For any_ Finance Module migration execution where the role system tables do not exist (isBugCondition returns true), the fixed migration SHALL fail fast with a clear error message indicating the missing master migration dependency and SHALL NOT create any partial schema changes.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Idempotent Master Migration

_For any_ database state where the master migration has already been applied (isBugCondition returns false), the fixed migrations SHALL produce exactly the same result as the original migrations, preserving all idempotent behavior, table structures, RLS policies, and seed data.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `supabase/migrations/20260321_finance_module_core.sql`

**Specific Changes**:

1. **Add Pre-Flight Dependency Check**: Insert validation block at the beginning of the migration
   - Check for existence of `role_assignments` table
   - Check for existence of `custom_roles` table
   - Check for existence of `employee_invitations` table
   - Raise clear error with remediation steps if any table is missing

2. **Add Dependency Documentation**: Add header comment explaining prerequisites
   - Document required master migration
   - List specific table dependencies
   - Provide migration order guidance
   - Reference TWO_LAYER_ROLE_SYSTEM.md documentation

3. **Enhance Error Messages**: Provide actionable error messages
   - Specify which migration must be run first
   - Include exact migration filename
   - Provide SQL command to check table existence
   - Link to migration guide documentation

4. **Add Verification Queries**: Include commented-out verification queries
   - Query to check all required tables exist
   - Query to verify role system schema structure
   - Query to test RLS policy compilation
   - Query to validate helper functions exist

5. **Wrap in Transaction Block**: Ensure atomic execution
   - Use explicit BEGIN/COMMIT for migration
   - Add ROLLBACK on error
   - Prevent partial schema application
   - Maintain database consistency

**File**: `supabase/migrations/20260320_master_consolidated_system.sql`

**Specific Changes**:

1. **Add Success Verification**: Add verification block at end of migration
   - Confirm all tables created successfully
   - Verify RLS policies are enabled
   - Check helper functions exist
   - Output success message with table count

2. **Add Migration Metadata**: Insert migration tracking record
   - Create migration_log table if needed
   - Record migration name, timestamp, status
   - Track dependencies for future migrations
   - Enable dependency graph queries

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: first, demonstrate the bug on unfixed code with missing dependencies; second, verify the fix detects missing dependencies and fails fast; third, verify correct execution when dependencies are met and preservation of existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis by reproducing the exact error conditions.

**Test Plan**: Create a fresh test database, attempt to apply the Finance Module migration without first applying the master migration, and observe the failure. Document the exact error message, line number, and database state.

**Test Cases**:
1. **Fresh Database Test**: Start with empty database → Apply Finance migration → Expect ERROR: relation "role_assignments" does not exist (will fail on unfixed code)
2. **Partial Master Migration Test**: Apply only profile column additions from master migration → Apply Finance migration → Expect ERROR: relation "role_assignments" does not exist (will fail on unfixed code)
3. **Missing Single Table Test**: Manually create role_assignments but not custom_roles → Apply Finance migration → Expect ERROR: relation "custom_roles" does not exist (will fail on unfixed code)
4. **Correct Order Test**: Apply master migration first → Apply Finance migration → Expect SUCCESS (should work on unfixed code)

**Expected Counterexamples**:
- PostgreSQL error "42P01: relation 'role_assignments' does not exist" at RLS policy creation
- Possible causes: Missing master migration, partial master migration, incorrect migration order

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (missing dependencies), the fixed migration fails fast with clear error messages and no partial schema changes.

**Pseudocode:**
```
FOR ALL migrationState WHERE isBugCondition(migrationState) DO
  result := executeFinanceMigration_fixed(migrationState)
  ASSERT result.status = 'failed'
  ASSERT result.errorMessage CONTAINS 'master_consolidated_system.sql'
  ASSERT result.errorMessage CONTAINS 'role_assignments'
  ASSERT result.tablesCreated = 0  -- No partial changes
  ASSERT result.providesRemediation = true
END FOR
```

**Test Cases**:
1. **Fresh Database with Fix**: Apply fixed Finance migration to empty database → Expect clear error message with master migration filename
2. **Partial Migration with Fix**: Apply fixed Finance migration after partial master migration → Expect error identifying missing tables
3. **Correct Order with Fix**: Apply master migration → Apply fixed Finance migration → Expect SUCCESS with all tables created
4. **Idempotency with Fix**: Apply master migration → Apply fixed Finance migration → Apply fixed Finance migration again → Expect SUCCESS (idempotent)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (dependencies are met), the fixed migration produces the same result as the original migration.

**Pseudocode:**
```
FOR ALL migrationState WHERE NOT isBugCondition(migrationState) DO
  ASSERT executeFinanceMigration_original(migrationState) = executeFinanceMigration_fixed(migrationState)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different database states
- It catches edge cases that manual unit tests might miss (e.g., existing data, partial schemas)
- It provides strong guarantees that behavior is unchanged for all valid migration sequences

**Test Plan**: Observe behavior on UNFIXED code first with master migration applied, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Schema Structure Preservation**: Verify all finance tables have identical structure (columns, types, constraints) after fixed migration
2. **RLS Policy Preservation**: Verify all RLS policies are identical (policy names, definitions, check clauses) after fixed migration
3. **Seed Data Preservation**: Verify standard chart of accounts has identical records after fixed migration
4. **Index Preservation**: Verify all indexes are created with identical definitions after fixed migration
5. **Function Preservation**: Verify helper functions (generate_journal_entry_number, post_journal_entry, etc.) are identical after fixed migration
6. **Trigger Preservation**: Verify update triggers are identical after fixed migration

### Unit Tests

- Test pre-flight check function with various database states (empty, partial, complete)
- Test error message generation with missing table scenarios
- Test transaction rollback on dependency check failure
- Test idempotent execution of both master and Finance migrations
- Test RLS policy compilation with role system tables present
- Test helper function execution after successful migration

### Property-Based Tests

- Generate random migration order sequences and verify only correct orders succeed
- Generate random database states (with/without role tables) and verify dependency checking
- Generate random user permission configurations and verify RLS policies work correctly
- Test that multiple migration executions produce identical final schema (idempotency)

### Integration Tests

- Test full migration sequence: master → Finance → verify all features work
- Test Finance Module RLS policies with actual user roles and permissions
- Test journal entry creation and posting with finance permissions
- Test account balance updates through ledger entries
- Test audit log creation for financial transactions
- Test that existing modules (vendors, issues, MOUs) continue to work after Finance migration

