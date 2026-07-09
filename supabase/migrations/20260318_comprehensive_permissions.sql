-- Comprehensive Permissions System Migration
-- Version: 2.0
-- Date: March 18, 2026
-- Description: Adds 150+ granular permissions for complete RBAC control

-- ============================================================================
-- PART 1: Create app_permissions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_permissions_slug ON app_permissions(slug);
CREATE INDEX IF NOT EXISTS idx_app_permissions_module ON app_permissions(module);
CREATE INDEX IF NOT EXISTS idx_app_permissions_module_resource ON app_permissions(module, resource);

-- ============================================================================
-- PART 2: Create role_permissions junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES app_permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================================================
-- PART 3: Insert all permissions
-- ============================================================================

-- Vendor Management Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('vendors.view', 'vendors', 'core', 'view', 'View Vendors', 'View vendor list and basic information'),
('vendors.create', 'vendors', 'core', 'create', 'Create Vendors', 'Create new vendor profiles'),
('vendors.edit', 'vendors', 'core', 'edit', 'Edit Vendors', 'Edit existing vendor information'),
('vendors.delete', 'vendors', 'core', 'delete', 'Delete Vendors', 'Delete vendor profiles'),
('vendors.manage', 'vendors', 'core', 'manage', 'Manage Vendors', 'Full vendor management access'),
('vendors.assign', 'vendors', 'assignments', 'assign', 'Assign Vendors', 'Assign vendors to employees/projects'),
('vendors.unassign', 'vendors', 'assignments', 'unassign', 'Unassign Vendors', 'Remove vendor assignments'),
('vendors.payments.view', 'vendors', 'payments', 'view', 'View Vendor Payments', 'View vendor payment information'),
('vendors.payments.create', 'vendors', 'payments', 'create', 'Create Payments', 'Create payment records'),
('vendors.payments.edit', 'vendors', 'payments', 'edit', 'Edit Payments', 'Edit payment records'),
('vendors.payments.approve', 'vendors', 'payments', 'approve', 'Approve Payments', 'Approve vendor payments'),
('vendors.payments.process', 'vendors', 'payments', 'process', 'Process Payments', 'Process vendor payments'),
('vendors.documents.view', 'vendors', 'documents', 'view', 'View Vendor Documents', 'View vendor documents'),
('vendors.documents.upload', 'vendors', 'documents', 'upload', 'Upload Documents', 'Upload vendor documents'),
('vendors.documents.delete', 'vendors', 'documents', 'delete', 'Delete Documents', 'Delete vendor documents'),
('vendors.remarks.view', 'vendors', 'remarks', 'view', 'View Remarks', 'View vendor remarks'),
('vendors.remarks.create', 'vendors', 'remarks', 'create', 'Create Remarks', 'Add vendor remarks'),
('vendors.remarks.edit', 'vendors', 'remarks', 'edit', 'Edit Remarks', 'Edit vendor remarks'),
('vendors.remarks.delete', 'vendors', 'remarks', 'delete', 'Delete Remarks', 'Delete vendor remarks'),
('vendors.status.change', 'vendors', 'status', 'change', 'Change Vendor Status', 'Change vendor status (active/inactive)'),
('vendors.safi.view', 'vendors', 'safi', 'view', 'View SAFI Scores', 'View SAFI scores'),
('vendors.safi.edit', 'vendors', 'safi', 'edit', 'Edit SAFI Scores', 'Edit SAFI scores')
ON CONFLICT (slug) DO NOTHING;

-- Issue Management Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('issues.view', 'issues', 'core', 'view', 'View Issues', 'View issues'),
('issues.create', 'issues', 'core', 'create', 'Create Issues', 'Create new issues'),
('issues.edit', 'issues', 'core', 'edit', 'Edit Issues', 'Edit existing issues'),
('issues.delete', 'issues', 'core', 'delete', 'Delete Issues', 'Delete issues'),
('issues.manage', 'issues', 'core', 'manage', 'Manage Issues', 'Full issue management access'),
('issues.assign', 'issues', 'assignments', 'assign', 'Assign Issues', 'Assign issues to users'),
('issues.reassign', 'issues', 'assignments', 'reassign', 'Reassign Issues', 'Reassign issues'),
('issues.status.change', 'issues', 'status', 'change', 'Change Issue Status', 'Change issue status'),
('issues.resolve', 'issues', 'status', 'resolve', 'Resolve Issues', 'Mark issues as resolved'),
('issues.close', 'issues', 'status', 'close', 'Close Issues', 'Close issues'),
('issues.reopen', 'issues', 'status', 'reopen', 'Reopen Issues', 'Reopen closed issues'),
('issues.priority.change', 'issues', 'priority', 'change', 'Change Priority', 'Change issue priority'),
('issues.comments.view', 'issues', 'comments', 'view', 'View Comments', 'View issue comments'),
('issues.comments.create', 'issues', 'comments', 'create', 'Add Comments', 'Add comments to issues'),
('issues.comments.edit', 'issues', 'comments', 'edit', 'Edit Comments', 'Edit own comments'),
('issues.comments.delete', 'issues', 'comments', 'delete', 'Delete Comments', 'Delete comments'),
('issues.ai.analyze', 'issues', 'ai', 'analyze', 'AI Analysis', 'Use AI issue analysis'),
('issues.ai.suggest', 'issues', 'ai', 'suggest', 'AI Suggestions', 'Get AI suggestions')
ON CONFLICT (slug) DO NOTHING;

-- MOU Management Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('mous.view', 'mous', 'core', 'view', 'View MOUs', 'View MOUs'),
('mous.create', 'mous', 'core', 'create', 'Create MOUs', 'Create new MOUs'),
('mous.edit', 'mous', 'core', 'edit', 'Edit MOUs', 'Edit existing MOUs'),
('mous.delete', 'mous', 'core', 'delete', 'Delete MOUs', 'Delete MOUs'),
('mous.manage', 'mous', 'core', 'manage', 'Manage MOUs', 'Full MOU management access'),
('mous.draft', 'mous', 'workflow', 'draft', 'Create Drafts', 'Create MOU drafts'),
('mous.submit', 'mous', 'workflow', 'submit', 'Submit MOUs', 'Submit MOUs for approval'),
('mous.approve', 'mous', 'workflow', 'approve', 'Approve MOUs', 'Approve MOUs'),
('mous.reject', 'mous', 'workflow', 'reject', 'Reject MOUs', 'Reject MOUs'),
('mous.sign', 'mous', 'workflow', 'sign', 'Sign MOUs', 'Sign MOUs'),
('mous.renew', 'mous', 'lifecycle', 'renew', 'Renew MOUs', 'Renew expiring MOUs'),
('mous.terminate', 'mous', 'lifecycle', 'terminate', 'Terminate MOUs', 'Terminate MOUs'),
('mous.archive', 'mous', 'lifecycle', 'archive', 'Archive MOUs', 'Archive MOUs'),
('mous.documents.view', 'mous', 'documents', 'view', 'View Documents', 'View MOU documents'),
('mous.documents.upload', 'mous', 'documents', 'upload', 'Upload Documents', 'Upload MOU documents'),
('mous.documents.download', 'mous', 'documents', 'download', 'Download Documents', 'Download MOU documents'),
('mous.documents.delete', 'mous', 'documents', 'delete', 'Delete Documents', 'Delete MOU documents'),
('mous.versions.view', 'mous', 'versions', 'view', 'View Versions', 'View MOU version history'),
('mous.versions.compare', 'mous', 'versions', 'compare', 'Compare Versions', 'Compare MOU versions'),
('mous.versions.restore', 'mous', 'versions', 'restore', 'Restore Versions', 'Restore previous versions'),
('mous.vault.access', 'mous', 'vault', 'access', 'Access Vault', 'Access MOU vault'),
('mous.vault.upload', 'mous', 'vault', 'upload', 'Upload to Vault', 'Upload to MOU vault'),
('mous.vault.organize', 'mous', 'vault', 'organize', 'Organize Vault', 'Organize vault documents'),
('mous.ai.extract', 'mous', 'ai', 'extract', 'AI Extraction', 'Use AI document extraction'),
('mous.ai.generate', 'mous', 'ai', 'generate', 'AI Generation', 'Use AI MOU generation')
ON CONFLICT (slug) DO NOTHING;

-- HR Module Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('hr.employees.view', 'hr', 'employees', 'view', 'View Employees', 'View employee list'),
('hr.employees.view_all', 'hr', 'employees', 'view_all', 'View All Employees', 'View all employees across departments'),
('hr.employees.create', 'hr', 'employees', 'create', 'Add Employees', 'Add new employees'),
('hr.employees.edit', 'hr', 'employees', 'edit', 'Edit Employees', 'Edit employee information'),
('hr.employees.delete', 'hr', 'employees', 'delete', 'Delete Employees', 'Delete employee records'),
('hr.employees.manage', 'hr', 'employees', 'manage', 'Manage Employees', 'Full employee management'),
('hr.lifecycle.hire', 'hr', 'lifecycle', 'hire', 'Process Hires', 'Process new hires'),
('hr.lifecycle.transfer', 'hr', 'lifecycle', 'transfer', 'Transfer Employees', 'Transfer employees'),
('hr.lifecycle.promote', 'hr', 'lifecycle', 'promote', 'Promote Employees', 'Promote employees'),
('hr.lifecycle.offboard', 'hr', 'lifecycle', 'offboard', 'Offboard Employees', 'Offboard employees'),
('hr.lifecycle.view', 'hr', 'lifecycle', 'view', 'View Lifecycle', 'View lifecycle history'),
('hr.attendance.view', 'hr', 'attendance', 'view', 'View Attendance', 'View attendance records'),
('hr.attendance.view_all', 'hr', 'attendance', 'view_all', 'View All Attendance', 'View all attendance records'),
('hr.attendance.mark', 'hr', 'attendance', 'mark', 'Mark Attendance', 'Mark attendance'),
('hr.attendance.edit', 'hr', 'attendance', 'edit', 'Edit Attendance', 'Edit attendance records'),
('hr.attendance.approve', 'hr', 'attendance', 'approve', 'Approve Attendance', 'Approve attendance'),
('hr.attendance.manage', 'hr', 'attendance', 'manage', 'Manage Attendance', 'Full attendance management'),
('hr.leave.view', 'hr', 'leave', 'view', 'View Leave', 'View leave requests'),
('hr.leave.view_all', 'hr', 'leave', 'view_all', 'View All Leave', 'View all leave requests'),
('hr.leave.request', 'hr', 'leave', 'request', 'Request Leave', 'Submit leave requests'),
('hr.leave.approve', 'hr', 'leave', 'approve', 'Approve Leave', 'Approve leave requests'),
('hr.leave.reject', 'hr', 'leave', 'reject', 'Reject Leave', 'Reject leave requests'),
('hr.leave.cancel', 'hr', 'leave', 'cancel', 'Cancel Leave', 'Cancel leave requests'),
('hr.leave.manage', 'hr', 'leave', 'manage', 'Manage Leave', 'Full leave management'),
('hr.performance.view', 'hr', 'performance', 'view', 'View Performance', 'View performance data'),
('hr.performance.view_all', 'hr', 'performance', 'view_all', 'View All Performance', 'View all performance data'),
('hr.performance.score', 'hr', 'performance', 'score', 'Score Performance', 'Score employee performance'),
('hr.performance.edit', 'hr', 'performance', 'edit', 'Edit Performance', 'Edit performance scores'),
('hr.performance.manage', 'hr', 'performance', 'manage', 'Manage Performance', 'Full performance management'),
('hr.appraisals.view', 'hr', 'appraisals', 'view', 'View Appraisals', 'View appraisals'),
('hr.appraisals.conduct', 'hr', 'appraisals', 'conduct', 'Conduct Appraisals', 'Conduct appraisals'),
('hr.appraisals.submit', 'hr', 'appraisals', 'submit', 'Submit Appraisals', 'Submit appraisal feedback'),
('hr.appraisals.approve', 'hr', 'appraisals', 'approve', 'Approve Appraisals', 'Approve appraisals'),
('hr.appraisals.manage', 'hr', 'appraisals', 'manage', 'Manage Appraisals', 'Full appraisal management'),
('hr.org.view', 'hr', 'org', 'view', 'View Org Chart', 'View organization chart'),
('hr.org.edit', 'hr', 'org', 'edit', 'Edit Org Structure', 'Edit organization structure'),
('hr.departments.manage', 'hr', 'departments', 'manage', 'Manage Departments', 'Manage departments'),
('hr.teams.manage', 'hr', 'teams', 'manage', 'Manage Teams', 'Manage teams'),
('hr.resources.view', 'hr', 'resources', 'view', 'View Resources', 'View resource planning'),
('hr.resources.allocate', 'hr', 'resources', 'allocate', 'Allocate Resources', 'Allocate resources'),
('hr.resources.manage', 'hr', 'resources', 'manage', 'Manage Resources', 'Full resource management'),
('hr.time.view', 'hr', 'time', 'view', 'View Time Logs', 'View time logs'),
('hr.time.log', 'hr', 'time', 'log', 'Log Time', 'Log time entries'),
('hr.time.approve', 'hr', 'time', 'approve', 'Approve Time', 'Approve time logs'),
('hr.time.manage', 'hr', 'time', 'manage', 'Manage Time', 'Full time tracking management')
ON CONFLICT (slug) DO NOTHING;

-- Project Management Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('projects.view', 'projects', 'core', 'view', 'View Projects', 'View projects'),
('projects.create', 'projects', 'core', 'create', 'Create Projects', 'Create new projects'),
('projects.edit', 'projects', 'core', 'edit', 'Edit Projects', 'Edit existing projects'),
('projects.delete', 'projects', 'core', 'delete', 'Delete Projects', 'Delete projects'),
('projects.manage', 'projects', 'core', 'manage', 'Manage Projects', 'Full project management access'),
('projects.status.change', 'projects', 'status', 'change', 'Change Status', 'Change project status'),
('projects.archive', 'projects', 'status', 'archive', 'Archive Projects', 'Archive projects'),
('tasks.view', 'projects', 'tasks', 'view', 'View Tasks', 'View tasks'),
('tasks.create', 'projects', 'tasks', 'create', 'Create Tasks', 'Create new tasks'),
('tasks.edit', 'projects', 'tasks', 'edit', 'Edit Tasks', 'Edit existing tasks'),
('tasks.delete', 'projects', 'tasks', 'delete', 'Delete Tasks', 'Delete tasks'),
('tasks.assign', 'projects', 'tasks', 'assign', 'Assign Tasks', 'Assign tasks to users'),
('tasks.status.change', 'projects', 'tasks', 'status_change', 'Change Task Status', 'Change task status'),
('sprints.view', 'projects', 'sprints', 'view', 'View Sprints', 'View sprints'),
('sprints.create', 'projects', 'sprints', 'create', 'Create Sprints', 'Create sprints'),
('sprints.edit', 'projects', 'sprints', 'edit', 'Edit Sprints', 'Edit sprints'),
('sprints.delete', 'projects', 'sprints', 'delete', 'Delete Sprints', 'Delete sprints'),
('sprints.manage', 'projects', 'sprints', 'manage', 'Manage Sprints', 'Full sprint management'),
('goals.view', 'projects', 'goals', 'view', 'View Goals', 'View project goals'),
('goals.create', 'projects', 'goals', 'create', 'Create Goals', 'Create goals'),
('goals.edit', 'projects', 'goals', 'edit', 'Edit Goals', 'Edit goals'),
('goals.delete', 'projects', 'goals', 'delete', 'Delete Goals', 'Delete goals'),
('goals.track', 'projects', 'goals', 'track', 'Track Goals', 'Track goal progress')
ON CONFLICT (slug) DO NOTHING;

-- Finance Module Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('finance.view', 'finance', 'core', 'view', 'View Finance', 'View financial data'),
('finance.manage', 'finance', 'core', 'manage', 'Manage Finance', 'Full finance management access'),
('finance.revenue.view', 'finance', 'revenue', 'view', 'View Revenue', 'View revenue data'),
('finance.revenue.create', 'finance', 'revenue', 'create', 'Create Revenue', 'Create revenue records'),
('finance.revenue.edit', 'finance', 'revenue', 'edit', 'Edit Revenue', 'Edit revenue records'),
('finance.payments.view', 'finance', 'payments', 'view', 'View Payments', 'View payment records'),
('finance.payments.create', 'finance', 'payments', 'create', 'Create Payments', 'Create payment records'),
('finance.payments.process', 'finance', 'payments', 'process', 'Process Payments', 'Process payments'),
('finance.payments.approve', 'finance', 'payments', 'approve', 'Approve Payments', 'Approve payments'),
('finance.expenses.view', 'finance', 'expenses', 'view', 'View Expenses', 'View expenses'),
('finance.expenses.create', 'finance', 'expenses', 'create', 'Create Expenses', 'Create expense records'),
('finance.expenses.approve', 'finance', 'expenses', 'approve', 'Approve Expenses', 'Approve expenses'),
('finance.invoices.view', 'finance', 'invoices', 'view', 'View Invoices', 'View invoices'),
('finance.invoices.create', 'finance', 'invoices', 'create', 'Create Invoices', 'Create invoices'),
('finance.invoices.send', 'finance', 'invoices', 'send', 'Send Invoices', 'Send invoices'),
('finance.invoices.manage', 'finance', 'invoices', 'manage', 'Manage Invoices', 'Full invoice management'),
('finance.reports.view', 'finance', 'reports', 'view', 'View Reports', 'View financial reports'),
('finance.reports.export', 'finance', 'reports', 'export', 'Export Reports', 'Export financial reports'),
('finance.reports.pl', 'finance', 'reports', 'pl', 'View P&L', 'View P&L statements'),
('finance.reports.cashflow', 'finance', 'reports', 'cashflow', 'View Cash Flow', 'View cash flow reports'),
('finance.subscriptions.view', 'finance', 'subscriptions', 'view', 'View Subscriptions', 'View subscriptions'),
('finance.subscriptions.manage', 'finance', 'subscriptions', 'manage', 'Manage Subscriptions', 'Manage subscriptions'),
('finance.ai.forecast', 'finance', 'ai', 'forecast', 'AI Forecasting', 'Use AI financial forecasting'),
('finance.ai.analyze', 'finance', 'ai', 'analyze', 'AI Analysis', 'Use AI financial analysis')
ON CONFLICT (slug) DO NOTHING;

-- Analytics Module Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('analytics.view', 'analytics', 'core', 'view', 'View Analytics', 'View analytics dashboards'),
('analytics.export', 'analytics', 'core', 'export', 'Export Analytics', 'Export analytics data'),
('analytics.advanced', 'analytics', 'core', 'advanced', 'Advanced Analytics', 'Access advanced analytics'),
('analytics.data.export', 'analytics', 'data', 'export', 'Export Data', 'Export raw data'),
('analytics.data.import', 'analytics', 'data', 'import', 'Import Data', 'Import data'),
('analytics.reports.create', 'analytics', 'reports', 'create', 'Create Reports', 'Create custom reports'),
('analytics.reports.share', 'analytics', 'reports', 'share', 'Share Reports', 'Share reports'),
('analytics.reports.schedule', 'analytics', 'reports', 'schedule', 'Schedule Reports', 'Schedule automated reports')
ON CONFLICT (slug) DO NOTHING;

-- Audit & Compliance Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('audit.view', 'audit', 'logs', 'view', 'View Audit Logs', 'View audit logs'),
('audit.export', 'audit', 'logs', 'export', 'Export Audit Logs', 'Export audit logs'),
('audit.search', 'audit', 'logs', 'search', 'Search Audit Logs', 'Search audit logs'),
('audit.assign', 'audit', 'access', 'assign', 'Assign Audit Access', 'Assign audit access'),
('audit.manage', 'audit', 'core', 'manage', 'Manage Audit', 'Full audit management'),
('compliance.view', 'audit', 'compliance', 'view', 'View Compliance', 'View compliance reports'),
('compliance.manage', 'audit', 'compliance', 'manage', 'Manage Compliance', 'Manage compliance settings')
ON CONFLICT (slug) DO NOTHING;

-- System Administration Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('system.users.view', 'system', 'users', 'view', 'View Users', 'View all users'),
('system.users.create', 'system', 'users', 'create', 'Create Users', 'Create new users'),
('system.users.edit', 'system', 'users', 'edit', 'Edit Users', 'Edit user information'),
('system.users.delete', 'system', 'users', 'delete', 'Delete Users', 'Delete users'),
('system.users.approve', 'system', 'users', 'approve', 'Approve Users', 'Approve new user registrations'),
('system.users.suspend', 'system', 'users', 'suspend', 'Suspend Users', 'Suspend user accounts'),
('system.roles.view', 'system', 'roles', 'view', 'View Roles', 'View roles'),
('system.roles.create', 'system', 'roles', 'create', 'Create Roles', 'Create custom roles'),
('system.roles.edit', 'system', 'roles', 'edit', 'Edit Roles', 'Edit roles'),
('system.roles.delete', 'system', 'roles', 'delete', 'Delete Roles', 'Delete roles'),
('system.roles.assign', 'system', 'roles', 'assign', 'Assign Roles', 'Assign roles to users'),
('system.roles.manage', 'system', 'roles', 'manage', 'Manage Roles', 'Full role management'),
('system.settings.view', 'system', 'settings', 'view', 'View Settings', 'View system settings'),
('system.settings.edit', 'system', 'settings', 'edit', 'Edit Settings', 'Edit system settings'),
('system.settings.manage', 'system', 'settings', 'manage', 'Manage Settings', 'Full settings management'),
('system.diagnostics', 'system', 'health', 'diagnostics', 'Run Diagnostics', 'Run system diagnostics'),
('system.health.view', 'system', 'health', 'view', 'View Health', 'View system health'),
('system.logs.view', 'system', 'logs', 'view', 'View Logs', 'View system logs'),
('system.integrations.view', 'system', 'integrations', 'view', 'View Integrations', 'View integrations'),
('system.integrations.manage', 'system', 'integrations', 'manage', 'Manage Integrations', 'Manage integrations')
ON CONFLICT (slug) DO NOTHING;

-- Notification Module Permissions
INSERT INTO app_permissions (slug, module, resource, action, display_name, description) VALUES
('notifications.view', 'notifications', 'core', 'view', 'View Notifications', 'View notifications'),
('notifications.manage', 'notifications', 'core', 'manage', 'Manage Notifications', 'Manage own notifications'),
('notifications.send', 'notifications', 'core', 'send', 'Send Notifications', 'Send notifications to users'),
('notifications.settings.edit', 'notifications', 'settings', 'edit', 'Edit Settings', 'Edit notification preferences'),
('notifications.channels.manage', 'notifications', 'channels', 'manage', 'Manage Channels', 'Manage notification channels'),
('notifications.broadcast', 'notifications', 'core', 'broadcast', 'Broadcast Notifications', 'Send broadcast notifications')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PART 4: Helper function to check permissions with wildcard support
-- ============================================================================

CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_permission_slug VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_has_permission BOOLEAN;
  v_module VARCHAR;
  v_resource VARCHAR;
BEGIN
  -- Check if user is admin (admins have all permissions)
  SELECT main_role = 'admin' INTO v_is_admin
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Check for exact permission match
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN app_permissions ap ON rp.permission_id = ap.id
    JOIN role_assignments ra ON rp.role_id = ra.role_id
    WHERE ra.user_id = p_user_id
    AND ap.slug = p_permission_slug
  ) INTO v_has_permission;
  
  IF v_has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- Check for wildcard permissions (module.*)
  v_module := split_part(p_permission_slug, '.', 1);
  v_resource := split_part(p_permission_slug, '.', 2);
  
  -- Check module wildcard (e.g., vendors.*)
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN app_permissions ap ON rp.permission_id = ap.id
    JOIN role_assignments ra ON rp.role_id = ra.role_id
    WHERE ra.user_id = p_user_id
    AND ap.module = v_module
    AND ap.action = '*'
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: Update system roles with new permissions
-- ============================================================================

-- This will be done via application code to map permissions to roles
-- based on the permission groups defined in RBAC_PERMISSIONS_COMPREHENSIVE.md

COMMENT ON TABLE app_permissions IS 'Granular permissions for RBAC system';
COMMENT ON TABLE role_permissions IS 'Junction table linking roles to permissions';
COMMENT ON FUNCTION check_user_permission IS 'Check if user has specific permission with wildcard support';
