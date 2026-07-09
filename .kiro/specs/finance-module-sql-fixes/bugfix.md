# Bugfix Requirements Document

## Introduction

The Finance Module contains multiple critical SQL migration errors and UI issues that prevent proper deployment and functionality. These issues include incorrect PL/pgSQL delimiter syntax causing parse errors, duplicate index creation attempts, references to non-existent enum values in RLS policies, and UI styling inconsistencies. The bugs affect database migration execution, role-based access control, and user interface presentation across the finance module.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN SQL migrations containing PL/pgSQL functions use single `$` delimiter syntax THEN the system throws "syntax error at or near $" errors during migration execution

1.2 WHEN migration 20260329_finance_vendor_profiles.sql attempts to create indexes THEN the system throws "relation idx_finance_vendor_profiles_vendor already exists" error due to duplicate index creation

1.3 WHEN RLS policies reference the `finance_admin` role value THEN the system throws "invalid input value for enum app_role: finance_admin" error because the app_role enum only contains ('admin', 'ops_manager', 'viewer', 'employee')

1.4 WHEN users access the vendor financial profiles tab THEN the scrollbar displays with default browser styling instead of the primary (pink) theme color

1.5 WHEN users view the vendor financial profiles tab THEN no drag functionality is available for horizontal scrolling

1.6 WHEN enterprise users access expense management THEN the label displays "My expenses" instead of organization-focused terminology

1.7 WHEN enterprise users need custom expense categories THEN no option exists to create custom categories

1.8 WHEN developers navigate the migrations folder THEN finance-related migrations (from 20260318 onwards) are scattered in the main folder instead of organized in a dedicated structure

### Expected Behavior (Correct)

2.1 WHEN SQL migrations containing PL/pgSQL functions use double `$$` delimiter syntax THEN the system SHALL execute migrations without syntax errors

2.2 WHEN migration 20260329_finance_vendor_profiles.sql creates indexes THEN the system SHALL use IF NOT EXISTS clause to prevent duplicate index errors

2.3 WHEN RLS policies need to check finance permissions THEN the system SHALL use the custom roles system by checking `custom_roles.permissions->>'finance'` instead of referencing non-existent enum values

2.4 WHEN users access the vendor financial profiles tab THEN the scrollbar SHALL be styled with primary (pink) color matching the application theme using `scrollbarColor: 'hsl(var(--primary) / 0.3) transparent'`

2.5 WHEN users view the vendor financial profiles tab THEN drag functionality SHALL be available for horizontal scrolling with visual feedback

2.6 WHEN enterprise users access expense management THEN the label SHALL display "Organization expenses" to reflect enterprise focus

2.7 WHEN enterprise users need custom expense categories THEN the system SHALL provide an option to create custom categories

2.8 WHEN developers navigate the migrations folder THEN all finance-related migrations (from 20260318 onwards) SHALL be organized in `supabase/migrations/finance/` folder structure

### Unchanged Behavior (Regression Prevention)

3.1 WHEN SQL migrations not related to finance execute THEN the system SHALL CONTINUE TO process them from the main migrations folder without errors

3.2 WHEN RLS policies use valid app_role enum values ('admin', 'ops_manager', 'viewer', 'employee') THEN the system SHALL CONTINUE TO enforce those policies correctly

3.3 WHEN users access other tabs in the finance module (Dashboard, Journal entries, Accounts, etc.) THEN the system SHALL CONTINUE TO display them with existing styling and functionality

3.4 WHEN non-enterprise users access expense management THEN the system SHALL CONTINUE TO display appropriate expense tracking features

3.5 WHEN users interact with other scrollable tabs in the application (HR module, etc.) THEN the system SHALL CONTINUE TO display with their existing scroll styling

3.6 WHEN existing journal entries, accounts, and financial transactions are queried THEN the system SHALL CONTINUE TO return correct data without performance degradation

3.7 WHEN users with admin role access finance features THEN the system SHALL CONTINUE TO grant full access based on main_role = 'admin' checks

3.8 WHEN custom roles without finance permissions attempt to access finance features THEN the system SHALL CONTINUE TO deny access appropriately
