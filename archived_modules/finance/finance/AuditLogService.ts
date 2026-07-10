/**
 * Audit Log Service
 * 
 * Manages audit trail with 7-year retention and export capabilities
 * Requirements: 19.4, 19.5, 19.9
 * Task: 48.1
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: any;
  newValues: any;
  changedBy: string | null;
  changedByEmail?: string;
  changedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isArchived?: boolean;
}

export interface AuditLogStatistics {
  totalActiveLogs: number;
  totalArchivedLogs: number;
  oldestActiveLog: string | null;
  newestActiveLog: string | null;
  logsPendingArchive: number;
  totalSizeMb: number;
}

export interface AuditLogSearchParams {
  entityType?: string;
  entityId?: string;
  action?: string;
  changedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogExportParams {
  startDate: Date;
  endDate: Date;
  entityTypes?: string[];
  includeArchived?: boolean;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Calculate the difference between old and new values
 */
export function calculateValueDiff(oldValues: any, newValues: any): Array<{
  field: string;
  oldValue: any;
  newValue: any;
}> {
  const diffs: Array<{ field: string; oldValue: any; newValue: any }> = [];

  if (!oldValues && !newValues) return diffs;

  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {})
  ]);

  allKeys.forEach(key => {
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  });

  return diffs;
}

// =====================================================
// Audit Log Service
// =====================================================

export class AuditLogService {
  /**
   * Log an audit entry
   * Requirements: 19.1, 19.2
   */
  async logAuditEntry(params: {
    entityType: string;
    entityId: string;
    action: string;
    oldValues?: any;
    newValues?: any;
  }): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase.from('finance_audit_log').insert({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValues: params.oldValues || null,
        newValues: params.newValues || null,
        changed_by: user.user?.id || null,
        ip_address: null, // Would need to be captured from request
        user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Failed to log audit entry:', error);
        throw error;
      }
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Search audit logs
   * Requirements: 19.6, 19.9
   */
  async searchAuditLogs(params: AuditLogSearchParams): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase.rpc('search_audit_logs', {
        p_entityType: params.entityType || null,
        p_entityId: params.entityId || null,
        p_action: params.action || null,
        p_changed_by: params.changedBy || null,
        p_start_date: params.startDate?.toISOString() || null,
        p_end_date: params.endDate?.toISOString() || null,
        p_limit: params.limit || 100,
        p_offset: params.offset || 0
      });

      if (error) {
        console.error('Failed to search audit logs:', error);
        toast.error('Failed to search audit logs');
        throw error;
      }

      return (data || []).map(entry => ({
        id: entry.id,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        action: entry.action,
        oldValues: entry.old_values,
        newValues: entry.new_values,
        changedBy: entry.changed_by,
        changedByEmail: entry.changed_by_email,
        changedAt: entry.changed_at,
        ipAddress: entry.ip_address,
        userAgent: entry.user_agent
      }));
    } catch (error) {
      console.error('Search audit logs failed:', error);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   * Requirements: 19.9
   */
  async exportAuditLogs(params: AuditLogExportParams): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase.rpc('export_audit_logs', {
        p_start_date: params.startDate.toISOString(),
        p_end_date: params.endDate.toISOString(),
        p_entity_types: params.entityTypes || null,
        p_include_archived: params.includeArchived || false
      });

      if (error) {
        console.error('Failed to export audit logs:', error);
        toast.error('Failed to export audit logs');
        throw error;
      }

      toast.success(`Exported ${data?.length || 0} audit log entries`);

      return (data || []).map(entry => ({
        id: entry.id,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        action: entry.action,
        oldValues: entry.old_values,
        newValues: entry.new_values,
        changedBy: entry.changed_by,
        changedByEmail: entry.changed_by_email,
        changedAt: entry.changed_at,
        ipAddress: entry.ip_address,
        userAgent: entry.user_agent,
        isArchived: entry.is_archived
      }));
    } catch (error) {
      console.error('Export audit logs failed:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   * Requirements: 19.9
   */
  async exportAuditLogsToCSV(params: AuditLogExportParams): Promise<void> {
    try {
      const logs = await this.exportAuditLogs(params);

      // Create CSV content
      const headers = [
        'ID',
        'Entity Type',
        'Entity ID',
        'Action',
        'Changed By',
        'Changed At',
        'IP Address',
        'Old Values',
        'New Values',
        'Archived'
      ];

      const rows = logs.map(log => [
        log.id,
        log.entityType,
        log.entityId,
        log.action,
        log.changedByEmail || log.changedBy || 'System',
        new Date(log.changedAt).toLocaleString(),
        log.ipAddress || 'N/A',
        JSON.stringify(log.oldValues || {}),
        JSON.stringify(log.newValues || {}),
        log.isArchived ? 'Yes' : 'No'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${params.startDate.toISOString().split('T')[0]}-to-${params.endDate.toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Audit logs exported to CSV');
    } catch (error) {
      console.error('Export to CSV failed:', error);
      toast.error('Failed to export audit logs to CSV');
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * Requirements: 19.4, 19.5
   */
  async getStatistics(): Promise<AuditLogStatistics> {
    try {
      const { data, error } = await supabase.rpc('get_audit_log_statistics');

      if (error) {
        console.error('Failed to get audit log statistics:', error);
        throw error;
      }

      const stats = data[0];

      return {
        totalActiveLogs: parseInt(stats.total_active_logs),
        totalArchivedLogs: parseInt(stats.total_archived_logs),
        oldestActiveLog: stats.oldest_active_log,
        newestActiveLog: stats.newest_active_log,
        logsPendingArchive: parseInt(stats.logs_pending_archive),
        totalSizeMb: parseFloat(stats.total_size_mb)
      };
    } catch (error) {
      console.error('Get statistics failed:', error);
      throw error;
    }
  }

  /**
   * Archive old audit logs (admin only)
   * Requirements: 19.4, 19.5
   */
  async archiveOldLogs(): Promise<{
    archivedCount: number;
    oldestDate: string | null;
    newestDate: string | null;
  }> {
    try {
      const { data, error } = await supabase.rpc('archive_old_audit_logs');

      if (error) {
        console.error('Failed to archive old logs:', error);
        toast.error('Failed to archive old logs');
        throw error;
      }

      const result = data[0];

      toast.success(`Archived ${result.archived_count} audit log entries`);

      return {
        archivedCount: result.archived_count,
        oldestDate: result.oldest_date,
        newestDate: result.newest_date
      };
    } catch (error) {
      console.error('Archive old logs failed:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific entity
   * Requirements: 19.6
   */
  async getEntityAuditTrail(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    return this.searchAuditLogs({
      entityType,
      entityId,
      limit: 1000
    });
  }

  /**
   * Get recent audit activity
   * Requirements: 19.6
   */
  async getRecentActivity(limit: number = 50): Promise<AuditLogEntry[]> {
    return this.searchAuditLogs({
      limit
    });
  }

  /**
   * Get audit activity by user
   * Requirements: 19.6
   */
  async getUserActivity(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    return this.searchAuditLogs({
      changedBy: userId,
      limit
    });
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
