# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Migration Dependency Verification Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (Finance migration fails when role system tables are missing)
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - fresh database without master migration applied
  - Test implementation details from Fault Condition in design:
    - Create fresh test database (or use transaction rollback for isolation)
    - Verify role system tables do NOT exist (role_assignments, custom_roles, employee_invitations)
    - Attempt to execute Finance Module migration (20260321_finance_module_core.sql)
    - Assert that migration FAILS with PostgreSQL error "42P01: relation 'role_assignments' does not exist"
    - Assert that NO finance tables are created (no partial schema changes)
    - Document the exact error message, line number, and database state
  - The test assertions should match the Expected Behavior Properties from design:
    - After fix: Migration should fail fast with clear error message indicating missing master migration
    - After fix: Error message should include remediation steps (apply master migration first)
    - After fix: No partial schema changes should occur (transaction rollback)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with PostgreSQL error (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - Example 1: Fresh database → Finance migration → ERROR at RLS policy creation
    - Example 2: Partial master migration → Finance migration → ERROR on missing tables
    - Example 3: Missing custom_roles table → Finance migration → ERROR on policy join
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Idempotent Migration and Existing Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (when master migration IS applied first):
    - Apply master migration (20260320_master_consolidated_system.sql) to test database
    - Verify role system tables exist (role_assignments, custom_roles, employee_invitations)
    - Apply Finance migration (20260321_finance_module_core.sql)
    - Observe and record: All finance tables created successfully
    - Observe and record: All RLS policies created successfully
    - Observe and record: Standard chart of accounts seed data inserted
    - Observe and record: Helper functions created (generate_journal_entry_number, post_journal_entry)
    - Observe and record: Triggers created for update tracking
    - Apply Finance migration AGAIN (test idempotency)
    - Observe and record: No errors, no duplicate data, schema unchanged
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Property: For all database states where master migration is applied, Finance migration produces identical schema structure
    - Property: For all database states where Finance migration is applied, re-applying produces no changes (idempotent)
    - Property: For all existing modules (vendors, issues, MOUs, HR), RLS policies continue to function after Finance migration
    - Property: For all notification triggers, helper functions continue to work after Finance migration
    - Property: For all user role assignments, permissions are enforced correctly after Finance migration
  - Property-based testing generates many test cases for stronger guarantees:
    - Generate random database states (with master migration applied)
    - Generate random user permission configurations
    - Generate random migration execution sequences (master → Finance → Finance)
    - Verify schema structure, RLS policies, seed data, functions, triggers are identical
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for Finance Module migration dependency verification

  - [x] 3.1 Add pre-flight dependency check to Finance migration
    - Open file: `supabase/migrations/20260321_finance_module_core.sql`
    - Add validation block at the beginning of the migration (after header comments)
    - Check for existence of required tables using PostgreSQL system catalogs:
      ```sql
      -- Pre-flight dependency check
      DO $$
      DECLARE
        missing_tables TEXT[];
      BEGIN
        -- Check for required role system tables
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'role_assignments') THEN
          missing_tables := array_append(missing_tables, 'role_assignments');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_roles') THEN
          missing_tables := array_append(missing_tables, 'custom_roles');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_invitations') THEN
          missing_tables := array_append(missing_tables, 'employee_invitations');
        END IF;
        
        -- Raise error if any tables are missing
        IF array_length(missing_tables, 1) > 0 THEN
          RAISE EXCEPTION 'Finance Module migration requires the 2-layer role system tables. Missing tables: %. Please apply migration 20260320_master_consolidated_system.sql first. See docs/SQL_MIGRATION_GUIDE.md for details.', array_to_string(missing_tables, ', ');
        END IF;
      END $$;
      ```
    - Add header comment documenting prerequisites:
      ```sql
      -- =====================================================
      -- Finance Module Core Migration
      -- =====================================================
      -- PREREQUISITES:
      --   - Master consolidated system migration (20260320_master_consolidated_system.sql)
      --   - Required tables: role_assignments, custom_roles, employee_invitations
      --   - See docs/TWO_LAYER_ROLE_SYSTEM.md for role system architecture
      --   - See docs/SQL_MIGRATION_GUIDE.md for migration order
      -- =====================================================
      ```
    - _Bug_Condition: isBugCondition(input) where NOT tableExists('role_assignments') AND NOT tableExists('custom_roles') AND NOT tableExists('employee_invitations')_
    - _Expected_Behavior: Migration fails fast with clear error message indicating missing master migration, provides remediation steps, no partial schema changes_
    - _Preservation: Master migration idempotency, existing RLS policies, notification triggers, Finance Module table creation, seed data insertion remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Add success verification to master migration
    - Open file: `supabase/migrations/20260320_master_consolidated_system.sql`
    - Add verification block at end of migration (before final commit)
    - Confirm all tables created successfully:
      ```sql
      -- Verify migration success
      DO $$
      DECLARE
        table_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO table_count
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations');
        
        IF table_count != 3 THEN
          RAISE EXCEPTION 'Master migration verification failed. Expected 3 role system tables, found %', table_count;
        END IF;
        
        RAISE NOTICE 'Master consolidated system migration completed successfully. Created % role system tables.', table_count;
      END $$;
      ```
    - Add comment documenting dependent migrations:
      ```sql
      -- =====================================================
      -- DEPENDENT MIGRATIONS:
      --   - Finance Module (20260321_finance_module_core.sql)
      --   - Any future migrations that use role_assignments or custom_roles
      -- =====================================================
      ```
    - _Preservation: Idempotent execution, existing table structures, RLS policies, helper functions remain unchanged_
    - _Requirements: 2.1, 3.1_

  - [x] 3.3 Add verification queries to Finance migration
    - Open file: `supabase/migrations/20260321_finance_module_core.sql`
    - Add commented-out verification queries at end of migration
    - Include queries to check table existence, schema structure, RLS policies:
      ```sql
      -- =====================================================
      -- VERIFICATION QUERIES (uncomment to test)
      -- =====================================================
      
      -- Check all required tables exist
      -- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('role_assignments', 'custom_roles', 'employee_invitations', 'accounts', 'journal_entries', 'ledger_entries');
      
      -- Verify role system schema structure
      -- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'role_assignments' ORDER BY ordinal_position;
      
      -- Test RLS policy compilation
      -- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename LIKE '%account%' OR tablename LIKE '%journal%' OR tablename LIKE '%ledger%';
      
      -- Validate helper functions exist
      -- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('generate_journal_entry_number', 'post_journal_entry', 'get_account_balance');
      ```
    - _Preservation: Finance Module table creation, seed data, functions, triggers remain unchanged_
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 3.4 Update SQL migration guide documentation
    - Open file: `docs/SQL_MIGRATION_GUIDE.md`
    - Add section on migration dependencies and ordering
    - Document the dependency chain: Master → Finance → Future modules
    - Provide troubleshooting steps for dependency errors
    - Include example commands to check table existence:
      ```sql
      -- Check if role system tables exist
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('role_assignments', 'custom_roles', 'employee_invitations');
      
      -- If tables are missing, apply master migration first
      -- psql -d your_database -f supabase/migrations/20260320_master_consolidated_system.sql
      ```
    - _Preservation: Existing migration guide content remains unchanged_
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Migration Dependency Verification Success
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (fail fast with clear error)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1:
      - Create fresh test database (or use transaction rollback)
      - Verify role system tables do NOT exist
      - Attempt to execute FIXED Finance Module migration
      - Assert that migration FAILS with clear error message (not PostgreSQL error)
      - Assert error message contains "20260320_master_consolidated_system.sql"
      - Assert error message contains remediation steps
      - Assert NO finance tables are created (transaction rollback worked)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - migration fails fast with helpful error)
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3, 2.4, 2.5)_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Idempotent Migration and Existing Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2:
      - Apply master migration to test database
      - Apply FIXED Finance migration
      - Verify all finance tables created successfully (same as unfixed)
      - Verify all RLS policies created successfully (same as unfixed)
      - Verify seed data inserted correctly (same as unfixed)
      - Verify helper functions created (same as unfixed)
      - Verify triggers created (same as unfixed)
      - Apply FIXED Finance migration AGAIN (test idempotency)
      - Verify no errors, no duplicate data, schema unchanged (same as unfixed)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - behavior preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: Preservation Requirements from design (3.1, 3.2, 3.3, 3.4, 3.5)_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run all exploration tests (task 1) - should now pass with clear error messages
  - Run all preservation tests (task 2) - should still pass with identical behavior
  - Verify Finance migration fails fast when dependencies missing
  - Verify Finance migration succeeds when dependencies met
  - Verify master migration remains idempotent
  - Verify existing modules (vendors, issues, MOUs, HR) continue to work
  - Test full migration sequence: master → Finance → verify all features work
  - Test Finance Module RLS policies with actual user roles and permissions
  - Ensure all tests pass, ask the user if questions arise
