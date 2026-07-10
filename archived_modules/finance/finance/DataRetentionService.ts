/**
 * Data Retention Service
 * 
 * Manages data archival, retention policies, and legal holds
 * Requirements: 29.1, 29.2, 29.3
 * Task: 48.2
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export interface ArchiveResult {
  archivedTransactions: number;
  archivedJournalEntries: number;
  archivedLedgerEntries: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ArchiveSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalJournalEntries: number;
  totalLedgerEntries: number;
  archivedAt: string;
}

export interface LegalHold {
  id: string;
  holdName: string;
  holdReason: string;
  caseNumber: string | null;
  entityType: string;
  entityIds: string[];
  holdStartDate: string;
  holdEndDate: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
}

export interface CreateLegalHoldParams {
  holdName: string;
  holdReason: string;
  entityType: string;
  entityIds: string[];
  caseNumber?: string;
  holdEndDate?: Date;
}

// =====================================================
// Data Retention Service
// =====================================================

export class DataRetentionService {
  /**
   * Archive old transactions (7+ years)
   * Requirements: 29.1, 29.2
   */
  async archiveOldTransactions(archiveBeforeDate?: Date): Promise<ArchiveResult> {
    try {
      const { data, error } = await supabase.rpc('archive_old_transactions', {
        p_archive_before_date: archiveBeforeDate?.toISOString().split('T')[0] || null
      });

      if (error) {
        console.error('Failed to archive old transactions:', error);
        toast.error('Failed to archive old transactions');
        throw error;
      }

      const result = data[0];

      if (result.archived_transactions > 0) {
        toast.success(
          `Archived ${result.archived_transactions} transactions, ` +
          `${result.archived_journal_entries} journal entries, ` +
          `${result.archived_ledger_entries} ledger entries`
        );
      } else {
        toast.info('No transactions found for archival');
      }

      return {
        archivedTransactions: result.archived_transactions,
        archivedJournalEntries: result.archived_journal_entries,
        archivedLedgerEntries: result.archived_ledger_entries,
        periodStart: result.period_start,
        periodEnd: result.period_end
      };
    } catch (error) {
      console.error('Archive old transactions failed:', error);
      throw error;
    }
  }

  /**
   * Get archive summaries
   * Requirements: 29.2
   */
  async getArchiveSummaries(
    startDate?: Date,
    endDate?: Date
  ): Promise<ArchiveSummary[]> {
    try {
      const { data, error } = await supabase.rpc('get_archive_summaries', {
        p_start_date: startDate?.toISOString().split('T')[0] || null,
        p_end_date: endDate?.toISOString().split('T')[0] || null
      });

      if (error) {
        console.error('Failed to get archive summaries:', error);
        throw error;
      }

      return (data || []).map(summary => ({
        id: summary.id,
        periodStart: summary.period_start,
        periodEnd: summary.period_end,
        totalTransactions: summary.total_transactions,
        totalRevenue: parseFloat(summary.total_revenue),
        totalExpenses: parseFloat(summary.total_expenses),
        netIncome: parseFloat(summary.net_income),
        totalJournalEntries: summary.total_journal_entries,
        totalLedgerEntries: summary.total_ledger_entries,
        archivedAt: summary.archived_at
      }));
    } catch (error) {
      console.error('Get archive summaries failed:', error);
      throw error;
    }
  }

  /**
   * Create legal hold
   * Requirements: 29.3
   */
  async createLegalHold(params: CreateLegalHoldParams): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('create_legal_hold', {
        p_hold_name: params.holdName,
        p_hold_reason: params.holdReason,
        p_entityType: params.entityType,
        p_entity_ids: params.entityIds,
        p_case_number: params.caseNumber || null,
        p_hold_end_date: params.holdEndDate?.toISOString().split('T')[0] || null
      });

      if (error) {
        console.error('Failed to create legal hold:', error);
        toast.error('Failed to create legal hold');
        throw error;
      }

      toast.success('Legal hold created successfully');
      return data;
    } catch (error) {
      console.error('Create legal hold failed:', error);
      throw error;
    }
  }

  /**
   * Release legal hold
   * Requirements: 29.3
   */
  async releaseLegalHold(holdId: string, releaseReason: string): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('release_legal_hold', {
        p_hold_id: holdId,
        p_release_reason: releaseReason
      });

      if (error) {
        console.error('Failed to release legal hold:', error);
        toast.error('Failed to release legal hold');
        throw error;
      }

      if (data) {
        toast.success('Legal hold released successfully');
      } else {
        toast.error('Legal hold not found or already released');
      }
    } catch (error) {
      console.error('Release legal hold failed:', error);
      throw error;
    }
  }

  /**
   * Get active legal holds
   * Requirements: 29.3
   */
  async getActiveLegalHolds(): Promise<LegalHold[]> {
    try {
      const { data, error } = await supabase
        .from('finance_legal_holds')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get legal holds:', error);
        throw error;
      }

      return (data || []).map(hold => ({
        id: hold.id,
        holdName: hold.hold_name,
        holdReason: hold.hold_reason,
        caseNumber: hold.case_number,
        entityType: hold.entity_type,
        entityIds: hold.entity_ids,
        holdStartDate: hold.hold_start_date,
        holdEndDate: hold.hold_end_date,
        isActive: hold.is_active,
        createdBy: hold.created_by,
        createdAt: hold.created_at,
        releasedBy: hold.released_by,
        releasedAt: hold.released_at,
        releaseReason: hold.release_reason
      }));
    } catch (error) {
      console.error('Get legal holds failed:', error);
      throw error;
    }
  }

  /**
   * Get all legal holds (including released)
   * Requirements: 29.3
   */
  async getAllLegalHolds(): Promise<LegalHold[]> {
    try {
      const { data, error } = await supabase
        .from('finance_legal_holds')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get all legal holds:', error);
        throw error;
      }

      return (data || []).map(hold => ({
        id: hold.id,
        holdName: hold.hold_name,
        holdReason: hold.hold_reason,
        caseNumber: hold.case_number,
        entityType: hold.entity_type,
        entityIds: hold.entity_ids,
        holdStartDate: hold.hold_start_date,
        holdEndDate: hold.hold_end_date,
        isActive: hold.is_active,
        createdBy: hold.created_by,
        createdAt: hold.created_at,
        releasedBy: hold.released_by,
        releasedAt: hold.released_at,
        releaseReason: hold.release_reason
      }));
    } catch (error) {
      console.error('Get all legal holds failed:', error);
      throw error;
    }
  }

  /**
   * Check if entity is under legal hold
   * Requirements: 29.3
   */
  async isUnderLegalHold(entityType: string, entityId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_under_legal_hold', {
        p_entityType: entityType,
        p_entityId: entityId
      });

      if (error) {
        console.error('Failed to check legal hold:', error);
        throw error;
      }

      return data || false;
    } catch (error) {
      console.error('Check legal hold failed:', error);
      throw error;
    }
  }

  /**
   * Get retention statistics
   * Requirements: 29.1, 29.2
   */
  async getRetentionStatistics(): Promise<{
    activeTransactions: number;
    archivedTransactions: number;
    activeLegalHolds: number;
    oldestActiveTransaction: string | null;
    totalArchivePeriods: number;
  }> {
    try {
      // Get active transaction count
      const { count: activeCount } = await supabase
        .from('finance_transactions')
        .select('*', { count: 'exact', head: true });

      // Get archived transaction count
      const summaries = await this.getArchiveSummaries();
      const archivedCount = summaries.reduce(
        (sum, s) => sum + s.totalTransactions,
        0
      );

      // Get active legal holds count
      const { count: holdsCount } = await supabase
        .from('finance_legal_holds')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get oldest active transaction
      const { data: oldestTxn } = await supabase
        .from('finance_transactions')
        .select('transaction_date')
        .order('transaction_date', { ascending: true })
        .limit(1)
        .single();

      return {
        activeTransactions: activeCount || 0,
        archivedTransactions: archivedCount,
        activeLegalHolds: holdsCount || 0,
        oldestActiveTransaction: oldestTxn?.transaction_date || null,
        totalArchivePeriods: summaries.length
      };
    } catch (error) {
      console.error('Get retention statistics failed:', error);
      throw error;
    }
  }

  /**
   * Export archive summary to CSV
   * Requirements: 29.2
   */
  async exportArchiveSummaryToCSV(summaries: ArchiveSummary[]): Promise<void> {
    try {
      const headers = [
        'Period Start',
        'Period End',
        'Total Transactions',
        'Total Revenue',
        'Total Expenses',
        'Net Income',
        'Journal Entries',
        'Ledger Entries',
        'Archived At'
      ];

      const rows = summaries.map(s => [
        s.periodStart,
        s.periodEnd,
        s.totalTransactions,
        s.totalRevenue,
        s.totalExpenses,
        s.netIncome,
        s.totalJournalEntries,
        s.totalLedgerEntries,
        new Date(s.archivedAt).toLocaleString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archive-summary-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Archive summary exported to CSV');
    } catch (error) {
      console.error('Export archive summary failed:', error);
      toast.error('Failed to export archive summary');
      throw error;
    }
  }
}

// Export singleton instance
export const dataRetentionService = new DataRetentionService();
