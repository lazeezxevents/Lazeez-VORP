# Bugfix Requirements Document

## Introduction

The Finance Module migration (`20260321_finance_module_core.sql`) fails with a PostgreSQL error when attempting to apply RLS policies that reference the `role_assignments` table. The error occurs because the master consolidated migration (`20260320_master_consolidated_system.sql`) that creates the 2-layer role system tables has not been applied to the database yet, creating a dependency violation.

This bug blocks the Finance Module implementation and prevents the system from utilizing the 2-layer role architecture (main_role + custom designations with JSONB permissions) for finance-related access control.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Finance Module migration (`20260321_finance_module_core.sql`) is executed THEN the system fails with error "ERROR: 42P01: relation 'role_assignments' does not exist"

1.2 WHEN RLS policies in the Finance Module attempt to reference `role_assignments` table THEN the PostgreSQL query planner cannot find the table and aborts the migration

1.3 WHEN the Finance Module migration is applied before the master migration THEN the database is left in an inconsistent state with partial table creation

1.4 WHEN checking for the existence of role system tables (`custom_roles`, `role_assignments`, `employee_invitations`) THEN these tables are not found in the database schema

### Expected Behavior (Correct)

2.1 WHEN the master consolidated migration (`20260320_master_consolidated_system.sql`) is executed first THEN the system SHALL successfully create all role system tables (`custom_roles`, `role_assignments`, `employee_invitations`) without errors

2.2 WHEN the Finance Module migration is executed after the master migration THEN the system SHALL successfully create all finance tables and RLS policies that reference `role_assignments` without errors

2.3 WHEN RLS policies in the Finance Module reference `role_assignments` table THEN the PostgreSQL query planner SHALL find the table and successfully compile the policies

2.4 WHEN checking for the existence of role system tables after master migration THEN the system SHALL return all three tables (`custom_roles`, `role_assignments`, `employee_invitations`) with correct schema structure

2.5 WHEN the Finance Module RLS policies check user permissions THEN the system SHALL correctly query the 2-layer role system (main_role from profiles + permissions from custom_roles via role_assignments)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the master migration is applied to a database that already has the role system tables THEN the system SHALL CONTINUE TO execute idempotently without errors or data loss

3.2 WHEN existing RLS policies in other modules (vendors, issues, MOUs, HR) reference the role system THEN the system SHALL CONTINUE TO function correctly after both migrations are applied

3.3 WHEN notification triggers reference `get_admin_ids()` and `get_manager_ids()` functions THEN the system SHALL CONTINUE TO route notifications based on Layer 1 main_role values

3.4 WHEN users with existing role assignments access the system THEN the system SHALL CONTINUE TO enforce their permissions correctly through the 2-layer architecture

3.5 WHEN the Finance Module tables are created with standard chart of accounts seed data THEN the system SHALL CONTINUE TO insert the default accounts without conflicts
