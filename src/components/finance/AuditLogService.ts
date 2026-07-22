/**
 * DEPRECATED: Audit Log Service - Finance module removed
 * This file is kept as a stub to prevent build errors
 * All finance module functionality has been archived
 */

// Stub export to prevent import errors
export const auditLogService = {
  logAuditEntry: async () => { /* no-op */ },
};

export interface AuditLogFilter {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface AuditLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  user_id: string | null;
  created_at: string;
  ip_address?: string;
}

export function calculateValueDiff(oldValues: any, newValues: any) {
  return [];
}
