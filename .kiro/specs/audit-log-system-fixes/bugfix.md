# Bugfix Requirements Document

## Introduction

After migrating the finance audit logs to the unified `audit_logs` table, several critical issues have emerged that affect data visibility, filtering accuracy, and user experience across both the main Audit Logs page and the Finance Audit Logs page. These issues impact the ability of administrators and managers to properly track system changes and maintain audit compliance.

The unified audit log system uses a single `audit_logs` table shared across the entire system, with separate hooks (`useAuditLogs.ts` for finance and `useMainAuditLogs.ts` for main system) and service layer (`AuditLogService.ts`) that handles querying with a `financeOnly` parameter to differentiate between finance-specific and system-wide audit logs.

This bugfix addresses data loss, incorrect filtering, missing UI controls, and access verification issues that have surfaced post-migration.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN viewing the main Audit Logs page (`/audit-logs`) THEN the system fails to display historical audit log data that existed before the migration

1.2 WHEN viewing the Finance Audit Logs page (`/finance` audit logs section) with `financeOnly=true` THEN the system displays ALL entity types instead of filtering to only finance-related entities (account, journal_entry, vendor_financial_profile, commission_rule, payment, invoice, revenue, expense, subscription, payout, rider_payout, delivery_payout)

1.3 WHEN using the main Audit Logs page (`AuditLogs.tsx`) THEN the system does not provide a reset filter button, while the Finance Audit Logs page (`AuditLogViewer.tsx`) does have this functionality

1.4 WHEN a manager accesses audit logs THEN the system may not properly restrict visibility to only their direct reports' audit logs, potentially exposing system-wide logs

1.5 WHEN querying finance audit logs with `financeOnly=true` THEN the system may not include `rider_payout` and `delivery_payout` entity types in the finance entity filter list

### Expected Behavior (Correct)

2.1 WHEN viewing the main Audit Logs page (`/audit-logs`) THEN the system SHALL display ALL historical audit log data from the `audit_logs` table without any data loss

2.2 WHEN viewing the Finance Audit Logs page with `financeOnly=true` THEN the system SHALL filter and display ONLY finance-related entity types: account, journal_entry, vendor_financial_profile, commission_rule, payment, invoice, revenue, expense, subscription, payout, rider_payout, delivery_payout

2.3 WHEN using the main Audit Logs page (`AuditLogs.tsx`) THEN the system SHALL provide a reset filter button that clears all active filters and resets the view

2.4 WHEN a manager accesses audit logs THEN the system SHALL restrict visibility to only audit logs for their direct reports (employees in departments they manage), not all system logs

2.5 WHEN querying finance audit logs with `financeOnly=true` THEN the system SHALL include `rider_payout` and `delivery_payout` entity types in the finance entity filter list and query results

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an administrator accesses audit logs THEN the system SHALL CONTINUE TO display all system-wide audit logs without restriction

3.2 WHEN filtering audit logs by entity type, entity ID, date range, or user THEN the system SHALL CONTINUE TO apply these filters correctly and return matching results

3.3 WHEN exporting audit logs to CSV format THEN the system SHALL CONTINUE TO generate properly formatted CSV files with all relevant columns

3.4 WHEN viewing audit log details with old_values and new_values THEN the system SHALL CONTINUE TO display the diff calculation showing changed fields correctly

3.5 WHEN paginating through audit logs THEN the system SHALL CONTINUE TO maintain correct page counts, offsets, and navigation controls

3.6 WHEN the Finance Audit Logs page queries with `financeOnly=true` THEN the system SHALL CONTINUE TO use the `queryAuditLogs` function from `AuditLogService.ts` with proper filtering

3.7 WHEN the main Audit Logs page queries without finance filtering THEN the system SHALL CONTINUE TO use the `useAuditLogs` hook from `useMainAuditLogs.ts` with user-based filtering for managers

3.8 WHEN displaying audit log entries THEN the system SHALL CONTINUE TO show entity type badges, action badges with appropriate colors, user information, timestamps, and changed fields

3.9 WHEN a user has insufficient permissions (not admin or manager) THEN the system SHALL CONTINUE TO display the access restricted message with lock icon

3.10 WHEN audit logs are created through `logAuditEntry` function THEN the system SHALL CONTINUE TO capture user context, calculate changed fields, and store complete before/after values
