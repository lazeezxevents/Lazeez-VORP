# Comprehensive RBAC Permissions System

**Version**: 2.0  
**Date**: March 16, 2026

---

## Permission Structure

Permissions follow the format: `module.resource.action`

Example: `vendors.payments.manage`

---

## Complete Permission List

### Vendor Management Module

```typescript
const vendorPermissions = {
  // Core Vendor Operations
  "vendors.view": "View vendor list and basic information",
  "vendors.create": "Create new vendor profiles",
  "vendors.edit": "Edit existing vendor information",
  "vendors.delete": "Delete vendor profiles",
  "vendors.manage": "Full vendor management access",
  
  // Vendor Assignments
  "vendors.assign": "Assign vendors to employees/projects",
  "vendors.unassign": "Remove vendor assignments",
  
  // Vendor Payments
  "vendors.payments.view": "View vendor payment information",
  "vendors.payments.create": "Create payment records",
  "vendors.payments.edit": "Edit payment records",
  "vendors.payments.approve": "Approve vendor payments",
  "vendors.payments.process": "Process vendor payments",
  
  // Vendor Documents
  "vendors.documents.view": "View vendor documents",
  "vendors.documents.upload": "Upload vendor documents",
  "vendors.documents.delete": "Delete vendor documents",
  
  // Vendor Remarks
  "vendors.remarks.view": "View vendor remarks",
  "vendors.remarks.create": "Add vendor remarks",
  "vendors.remarks.edit": "Edit vendor remarks",
  "vendors.remarks.delete": "Delete vendor remarks",
  
  // Vendor Status
  "vendors.status.change": "Change vendor status (active/inactive)",
  "vendors.safi.view": "View SAFI scores",
  "vendors.safi.edit": "Edit SAFI scores",
};
```

### Issue Management Module

```typescript
const issuePermissions = {
  // Core Issue Operations
  "issues.view": "View issues",
  "issues.create": "Create new issues",
  "issues.edit": "Edit existing issues",
  "issues.delete": "Delete issues",
  "issues.manage": "Full issue management access",
  
  // Issue Assignment
  "issues.assign": "Assign issues to users",
  "issues.reassign": "Reassign issues",
  
  // Issue Status
  "issues.status.change": "Change issue status",
  "issues.resolve": "Mark issues as resolved",
  "issues.close": "Close issues",
  "issues.reopen": "Reopen closed issues",
  
  // Issue Priority
  "issues.priority.change": "Change issue priority",
  
  // Issue Comments
  "issues.comments.view": "View issue comments",
  "issues.comments.create": "Add comments to issues",
  "issues.comments.edit": "Edit own comments",
  "issues.comments.delete": "Delete comments",
  
  // AI Features
  "issues.ai.analyze": "Use AI issue analysis",
  "issues.ai.suggest": "Get AI suggestions",
};
```

### MOU Management Module

```typescript
const mouPermissions = {
  // Core MOU Operations
  "mous.view": "View MOUs",
  "mous.create": "Create new MOUs",
  "mous.edit": "Edit existing MOUs",
  "mous.delete": "Delete MOUs",
  "mous.manage": "Full MOU management access",
  
  // MOU Workflow
  "mous.draft": "Create MOU drafts",
  "mous.submit": "Submit MOUs for approval",
  "mous.approve": "Approve MOUs",
  "mous.reject": "Reject MOUs",
  "mous.sign": "Sign MOUs",
  
  // MOU Lifecycle
  "mous.renew": "Renew expiring MOUs",
  "mous.terminate": "Terminate MOUs",
  "mous.archive": "Archive MOUs",
  
  // MOU Documents
  "mous.documents.view": "View MOU documents",
  "mous.documents.upload": "Upload MOU documents",
  "mous.documents.download": "Download MOU documents",
  "mous.documents.delete": "Delete MOU documents",
  
  // MOU Versions
  "mous.versions.view": "View MOU version history",
  "mous.versions.compare": "Compare MOU versions",
  "mous.versions.restore": "Restore previous versions",
  
  // MOU Vault
  "mous.vault.access": "Access MOU vault",
  "mous.vault.upload": "Upload to MOU vault",
  "mous.vault.organize": "Organize vault documents",
  
  // AI Features
  "mous.ai.extract": "Use AI document extraction",
  "mous.ai.generate": "Use AI MOU generation",
};
```

### HR Module

```typescript
const hrPermissions = {
  // Employee Management
  "hr.employees.view": "View employee list",
  "hr.employees.view_all": "View all employees across departments",
  "hr.employees.create": "Add new employees",
  "hr.employees.edit": "Edit employee information",
  "hr.employees.delete": "Delete employee records",
  "hr.employees.manage": "Full employee management",
  
  // Employee Lifecycle
  "hr.lifecycle.hire": "Process new hires",
  "hr.lifecycle.transfer": "Transfer employees",
  "hr.lifecycle.promote": "Promote employees",
  "hr.lifecycle.offboard": "Offboard employees",
  "hr.lifecycle.view": "View lifecycle history",
  
  // Attendance Management
  "hr.attendance.view": "View attendance records",
  "hr.attendance.view_all": "View all attendance records",
  "hr.attendance.mark": "Mark attendance",
  "hr.attendance.edit": "Edit attendance records",
  "hr.attendance.approve": "Approve attendance",
  "hr.attendance.manage": "Full attendance management",
  
  // Leave Management
  "hr.leave.view": "View leave requests",
  "hr.leave.view_all": "View all leave requests",
  "hr.leave.request": "Submit leave requests",
  "hr.leave.approve": "Approve leave requests",
  "hr.leave.reject": "Reject leave requests",
  "hr.leave.cancel": "Cancel leave requests",
  "hr.leave.manage": "Full leave management",
  
  // Performance Management
  "hr.performance.view": "View performance data",
  "hr.performance.view_all": "View all performance data",
  "hr.performance.score": "Score employee performance",
  "hr.performance.edit": "Edit performance scores",
  "hr.performance.manage": "Full performance management",
  
  // Appraisals
  "hr.appraisals.view": "View appraisals",
  "hr.appraisals.conduct": "Conduct appraisals",
  "hr.appraisals.submit": "Submit appraisal feedback",
  "hr.appraisals.approve": "Approve appraisals",
  "hr.appraisals.manage": "Full appraisal management",
  
  // Organization Structure
  "hr.org.view": "View organization chart",
  "hr.org.edit": "Edit organization structure",
  "hr.departments.manage": "Manage departments",
  "hr.teams.manage": "Manage teams",
  
  // Resource Planning
  "hr.resources.view": "View resource planning",
  "hr.resources.allocate": "Allocate resources",
  "hr.resources.manage": "Full resource management",
  
  // Time Tracking
  "hr.time.view": "View time logs",
  "hr.time.log": "Log time entries",
  "hr.time.approve": "Approve time logs",
  "hr.time.manage": "Full time tracking management",
};
```

### Project Management Module

```typescript
const projectPermissions = {
  // Core Project Operations
  "projects.view": "View projects",
  "projects.create": "Create new projects",
  "projects.edit": "Edit existing projects",
  "projects.delete": "Delete projects",
  "projects.manage": "Full project management access",
  
  // Project Status
  "projects.status.change": "Change project status",
  "projects.archive": "Archive projects",
  
  // Task Management
  "tasks.view": "View tasks",
  "tasks.create": "Create new tasks",
  "tasks.edit": "Edit existing tasks",
  "tasks.delete": "Delete tasks",
  "tasks.assign": "Assign tasks to users",
  "tasks.status.change": "Change task status",
  
  // Sprint Management
  "sprints.view": "View sprints",
  "sprints.create": "Create sprints",
  "sprints.edit": "Edit sprints",
  "sprints.delete": "Delete sprints",
  "sprints.manage": "Full sprint management",
  
  // Goals Management
  "goals.view": "View project goals",
  "goals.create": "Create goals",
  "goals.edit": "Edit goals",
  "goals.delete": "Delete goals",
  "goals.track": "Track goal progress",
};
```

### Finance Module

```typescript
const financePermissions = {
  // Core Finance Operations
  "finance.view": "View financial data",
  "finance.manage": "Full finance management access",
  
  // Revenue Management
  "finance.revenue.view": "View revenue data",
  "finance.revenue.create": "Create revenue records",
  "finance.revenue.edit": "Edit revenue records",
  
  // Payments
  "finance.payments.view": "View payment records",
  "finance.payments.create": "Create payment records",
  "finance.payments.process": "Process payments",
  "finance.payments.approve": "Approve payments",
  
  // Expenses
  "finance.expenses.view": "View expenses",
  "finance.expenses.create": "Create expense records",
  "finance.expenses.approve": "Approve expenses",
  
  // Invoicing
  "finance.invoices.view": "View invoices",
  "finance.invoices.create": "Create invoices",
  "finance.invoices.send": "Send invoices",
  "finance.invoices.manage": "Full invoice management",
  
  // Financial Reports
  "finance.reports.view": "View financial reports",
  "finance.reports.export": "Export financial reports",
  "finance.reports.pl": "View P&L statements",
  "finance.reports.cashflow": "View cash flow reports",
  
  // Subscriptions
  "finance.subscriptions.view": "View subscriptions",
  "finance.subscriptions.manage": "Manage subscriptions",
  
  // AI Features
  "finance.ai.forecast": "Use AI financial forecasting",
  "finance.ai.analyze": "Use AI financial analysis",
};
```

### Analytics Module

```typescript
const analyticsPermissions = {
  // Core Analytics
  "analytics.view": "View analytics dashboards",
  "analytics.export": "Export analytics data",
  "analytics.advanced": "Access advanced analytics",
  
  // Data Export
  "analytics.data.export": "Export raw data",
  "analytics.data.import": "Import data",
  
  // Custom Reports
  "analytics.reports.create": "Create custom reports",
  "analytics.reports.share": "Share reports",
  "analytics.reports.schedule": "Schedule automated reports",
};
```

### Audit & Compliance Module

```typescript
const auditPermissions = {
  // Audit Logs
  "audit.view": "View audit logs",
  "audit.export": "Export audit logs",
  "audit.search": "Search audit logs",
  
  // Audit Assignment
  "audit.assign": "Assign audit access",
  "audit.manage": "Full audit management",
  
  // Compliance
  "compliance.view": "View compliance reports",
  "compliance.manage": "Manage compliance settings",
};
```

### System Administration Module

```typescript
const systemPermissions = {
  // User Management
  "system.users.view": "View all users",
  "system.users.create": "Create new users",
  "system.users.edit": "Edit user information",
  "system.users.delete": "Delete users",
  "system.users.approve": "Approve new user registrations",
  "system.users.suspend": "Suspend user accounts",
  
  // Role Management
  "system.roles.view": "View roles",
  "system.roles.create": "Create custom roles",
  "system.roles.edit": "Edit roles",
  "system.roles.delete": "Delete roles",
  "system.roles.assign": "Assign roles to users",
  "system.roles.manage": "Full role management",
  
  // System Settings
  "system.settings.view": "View system settings",
  "system.settings.edit": "Edit system settings",
  "system.settings.manage": "Full settings management",
  
  // System Health
  "system.diagnostics": "Run system diagnostics",
  "system.health.view": "View system health",
  "system.logs.view": "View system logs",
  
  // Integrations
  "system.integrations.view": "View integrations",
  "system.integrations.manage": "Manage integrations",
};
```

### Notification Module

```typescript
const notificationPermissions = {
  // Core Notifications
  "notifications.view": "View notifications",
  "notifications.manage": "Manage own notifications",
  "notifications.send": "Send notifications to users",
  
  // Notification Settings
  "notifications.settings.edit": "Edit notification preferences",
  "notifications.channels.manage": "Manage notification channels",
  
  // Broadcast
  "notifications.broadcast": "Send broadcast notifications",
};
```

---

## Permission Groups by Role

### System Administrator
```typescript
const adminPermissions = [
  "*.*.* ", // All permissions
];
```

### HR Manager
```typescript
const hrManagerPermissions = [
  "hr.*.*",
  "vendors.view",
  "issues.view",
  "issues.create",
  "mous.view",
  "projects.view",
  "analytics.view",
  "analytics.export",
  "audit.view",
  "notifications.*",
];
```

### Department Manager
```typescript
const deptManagerPermissions = [
  "vendors.*",
  "issues.*",
  "mous.*",
  "hr.employees.view",
  "hr.attendance.*",
  "hr.leave.approve",
  "hr.performance.view",
  "hr.appraisals.conduct",
  "projects.*",
  "tasks.*",
  "analytics.view",
  "notifications.*",
];
```

### Vendor Manager
```typescript
const vendorManagerPermissions = [
  "vendors.*",
  "issues.*",
  "mous.*",
  "finance.payments.view",
  "finance.payments.manage",
  "analytics.view",
  "analytics.export",
  "notifications.*",
];
```

### Standard Employee
```typescript
const employeePermissions = [
  "vendors.view",
  "issues.view",
  "issues.create",
  "mous.view",
  "hr.attendance.mark",
  "hr.leave.request",
  "hr.time.log",
  "projects.view",
  "tasks.view",
  "notifications.view",
  "notifications.manage",
];
```

### Senior Employee
```typescript
const seniorEmployeePermissions = [
  "vendors.view",
  "vendors.create",
  "issues.*",
  "mous.view",
  "hr.attendance.mark",
  "hr.leave.request",
  "hr.time.log",
  "projects.view",
  "projects.create",
  "tasks.*",
  "analytics.view",
  "notifications.*",
];
```

---

## Implementation Notes

### Permission Check Function
```typescript
function hasPermission(userPermissions: string[], required: string): boolean {
  // Check for wildcard permissions
  if (userPermissions.includes("*.*.*")) return true;
  
  // Check for module wildcard (e.g., "vendors.*.*")
  const [module] = required.split(".");
  if (userPermissions.includes(`${module}.*.*`)) return true;
  
  // Check for resource wildcard (e.g., "vendors.payments.*")
  const [mod, resource] = required.split(".");
  if (userPermissions.includes(`${mod}.${resource}.*`)) return true;
  
  // Check for exact permission
  return userPermissions.includes(required);
}
```

### Usage in Components
```typescript
// Single permission check
if (hasPermission("vendors.create")) {
  // Show create button
}

// Multiple permission check (OR)
if (hasPermission("vendors.edit") || hasPermission("vendors.manage")) {
  // Show edit button
}

// Multiple permission check (AND)
if (hasPermission("vendors.edit") && hasPermission("vendors.approve")) {
  // Show approve button
}
```

---

## Migration Strategy

1. **Phase 1**: Add all permissions to database
2. **Phase 2**: Update existing roles with new permissions
3. **Phase 3**: Add permission checks to components
4. **Phase 4**: Test and validate
5. **Phase 5**: Document and deploy

---

**Total Permissions**: 150+  
**Last Updated**: March 16, 2026
