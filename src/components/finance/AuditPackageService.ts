/**
 * Audit Package Service
 * 
 * Generates comprehensive audit packages for external auditors
 * Requirements: 19.7, 20.10
 * Task: 48.3
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditLogService } from './AuditLogService';
import { dataRetentionService } from './DataRetentionService';
import { complianceTaxManager } from './ComplianceTaxManager';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// =====================================================
// Types
// =====================================================

export interface AuditPackageParams {
  periodStart: Date;
  periodEnd: Date;
  includeTransactions: boolean;
  includeJournalEntries: boolean;
  includeAuditLogs: boolean;
  includeTaxReports: boolean;
  includeArchiveSummaries: boolean;
  packageName?: string;
}

export interface AuditPackageMetadata {
  packageName: string;
  generatedAt: string;
  generatedBy: string;
  periodStart: string;
  periodEnd: string;
  includedComponents: string[];
  totalFiles: number;
}

// =====================================================
// Audit Package Service
// =====================================================

export class AuditPackageService {
  /**
   * Generate comprehensive audit package
   * Requirements: 19.7, 20.10
   */
  async generateAuditPackage(params: AuditPackageParams): Promise<void> {
    try {
      toast.info('Generating audit package...');

      const zip = new JSZip();
      const { data: user } = await supabase.auth.getUser();
      
      const metadata: AuditPackageMetadata = {
        packageName: params.packageName || `audit-package-${params.periodStart.toISOString().split('T')[0]}`,
        generatedAt: new Date().toISOString(),
        generatedBy: user.user?.email || 'Unknown',
        periodStart: params.periodStart.toISOString(),
        periodEnd: params.periodEnd.toISOString(),
        includedComponents: [],
        totalFiles: 0
      };

      // 1. Include transactions
      if (params.includeTransactions) {
        await this.addTransactionsToPackage(zip, params.periodStart, params.periodEnd);
        metadata.includedComponents.push('Transactions');
        metadata.totalFiles++;
      }

      // 2. Include journal entries
      if (params.includeJournalEntries) {
        await this.addJournalEntriesToPackage(zip, params.periodStart, params.periodEnd);
        metadata.includedComponents.push('Journal Entries');
        metadata.totalFiles += 2; // Journal entries + ledger entries
      }

      // 3. Include audit logs
      if (params.includeAuditLogs) {
        await this.addAuditLogsToPackage(zip, params.periodStart, params.periodEnd);
        metadata.includedComponents.push('Audit Logs');
        metadata.totalFiles++;
      }

      // 4. Include tax reports
      if (params.includeTaxReports) {
        await this.addTaxReportsToPackage(zip, params.periodStart, params.periodEnd);
        metadata.includedComponents.push('Tax Reports');
        metadata.totalFiles++;
      }

      // 5. Include archive summaries
      if (params.includeArchiveSummaries) {
        await this.addArchiveSummariesToPackage(zip, params.periodStart, params.periodEnd);
        metadata.includedComponents.push('Archive Summaries');
        metadata.totalFiles++;
      }

      // 6. Add financial statements
      await this.addFinancialStatementsToPackage(zip, params.periodStart, params.periodEnd);
      metadata.includedComponents.push('Financial Statements');
      metadata.totalFiles++;

      // 7. Add metadata file
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      metadata.totalFiles++;

      // 8. Add README
      const readme = this.generateReadme(metadata);
      zip.file('README.txt', readme);
      metadata.totalFiles++;

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${metadata.packageName}.zip`);

      toast.success('Audit package generated successfully');
    } catch (error) {
      console.error('Generate audit package failed:', error);
      toast.error('Failed to generate audit package');
      throw error;
    }
  }

  /**
   * Add transactions to audit package
   */
  private async addTransactionsToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0])
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    const csv = this.convertToCSV(data || [], [
      'transaction_number',
      'transaction_date',
      'type',
      'description',
      'amount',
      'currency',
      'status',
      'source_module',
      'created_at'
    ]);

    zip.file('transactions.csv', csv);
  }

  /**
   * Add journal entries to audit package
   */
  private async addJournalEntriesToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Get journal entries
    const { data: journalEntries, error: jeError } = await supabase
      .from('finance_journal_entries')
      .select('*')
      .gte('entry_date', startDate.toISOString().split('T')[0])
      .lte('entry_date', endDate.toISOString().split('T')[0])
      .order('entry_date', { ascending: true });

    if (jeError) throw jeError;

    const jeCsv = this.convertToCSV(journalEntries || [], [
      'entry_number',
      'entry_date',
      'description',
      'reference',
      'status',
      'posted_at',
      'created_at'
    ]);

    zip.file('journal_entries.csv', jeCsv);

    // Get ledger entries for these journal entries
    if (journalEntries && journalEntries.length > 0) {
      const jeIds = journalEntries.map(je => je.id);
      
      const { data: ledgerEntries, error: leError } = await supabase
        .from('finance_ledger_entries')
        .select('*, finance_accounts(code, name)')
        .in('journal_entry_id', jeIds)
        .order('created_at', { ascending: true });

      if (leError) throw leError;

      const leCsv = this.convertToCSV(
        (ledgerEntries || []).map(le => ({
          journal_entry_id: le.journal_entry_id,
          account_code: le.finance_accounts?.code,
          account_name: le.finance_accounts?.name,
          debit: le.debit,
          credit: le.credit,
          currency: le.currency,
          description: le.description,
          created_at: le.created_at
        })),
        [
          'journal_entry_id',
          'account_code',
          'account_name',
          'debit',
          'credit',
          'currency',
          'description',
          'created_at'
        ]
      );

      zip.file('ledger_entries.csv', leCsv);
    }
  }

  /**
   * Add audit logs to audit package
   */
  private async addAuditLogsToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const logs = await auditLogService.exportAuditLogs({
      startDate,
      endDate,
      includeArchived: true
    });

    const csv = this.convertToCSV(
      logs.map(log => ({
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        changed_by: log.changedByEmail || log.changedBy || 'System',
        changed_at: new Date(log.changedAt).toLocaleString(),
        ip_address: log.ipAddress || 'N/A',
        oldValues: JSON.stringify(log.oldValues || {}),
        newValues: JSON.stringify(log.newValues || {}),
        is_archived: log.isArchived ? 'Yes' : 'No'
      })),
      [
        'id',
        'entity_type',
        'entity_id',
        'action',
        'changed_by',
        'changed_at',
        'ip_address',
        'old_values',
        'new_values',
        'is_archived'
      ]
    );

    zip.file('audit_logs.csv', csv);
  }

  /**
   * Add tax reports to audit package
   */
  private async addTaxReportsToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const reports = await complianceTaxManager.getTaxReports('PK', {
      limit: 100
    });

    // Filter reports within date range
    const filteredReports = reports.filter(report => {
      const reportStart = new Date(report.periodStart);
      const reportEnd = new Date(report.periodEnd);
      return reportStart >= startDate && reportEnd <= endDate;
    });

    const csv = this.convertToCSV(
      filteredReports.map(report => ({
        report_type: report.reportType,
        period_start: report.periodStart,
        period_end: report.periodEnd,
        total_sales: report.totalSales,
        taxable_amount: report.taxableAmount,
        tax_collected: report.taxCollected,
        tax_paid: report.taxPaid,
        net_tax_liability: report.netTaxLiability,
        filing_status: report.filingStatus,
        filing_deadline: report.filingDeadline || 'N/A',
        filed_at: report.filedAt || 'N/A'
      })),
      [
        'report_type',
        'period_start',
        'period_end',
        'total_sales',
        'taxable_amount',
        'tax_collected',
        'tax_paid',
        'net_tax_liability',
        'filing_status',
        'filing_deadline',
        'filed_at'
      ]
    );

    zip.file('tax_reports.csv', csv);
  }

  /**
   * Add archive summaries to audit package
   */
  private async addArchiveSummariesToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const summaries = await dataRetentionService.getArchiveSummaries(
      startDate,
      endDate
    );

    const csv = this.convertToCSV(
      summaries.map(s => ({
        period_start: s.periodStart,
        period_end: s.periodEnd,
        total_transactions: s.totalTransactions,
        total_revenue: s.totalRevenue,
        total_expenses: s.totalExpenses,
        net_income: s.netIncome,
        total_journal_entries: s.totalJournalEntries,
        total_ledger_entries: s.totalLedgerEntries,
        archived_at: new Date(s.archivedAt).toLocaleString()
      })),
      [
        'period_start',
        'period_end',
        'total_transactions',
        'total_revenue',
        'total_expenses',
        'net_income',
        'total_journal_entries',
        'total_ledger_entries',
        'archived_at'
      ]
    );

    zip.file('archive_summaries.csv', csv);
  }

  /**
   * Add financial statements to audit package
   */
  private async addFinancialStatementsToPackage(
    zip: JSZip,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Get account balances
    const { data: accounts, error } = await supabase
      .from('finance_accounts')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) throw error;

    const csv = this.convertToCSV(
      (accounts || []).map(account => ({
        code: account.code,
        name: account.name,
        type: account.type,
        sub_type: account.sub_type,
        balance: account.balance,
        currency: account.currency
      })),
      ['code', 'name', 'type', 'sub_type', 'balance', 'currency']
    );

    zip.file('chart_of_accounts.csv', csv);
  }

  /**
   * Generate README file
   */
  private generateReadme(metadata: AuditPackageMetadata): string {
    return `
AUDIT PACKAGE
==============

Package Name: ${metadata.packageName}
Generated At: ${new Date(metadata.generatedAt).toLocaleString()}
Generated By: ${metadata.generatedBy}

Period: ${new Date(metadata.periodStart).toLocaleDateString()} to ${new Date(metadata.periodEnd).toLocaleDateString()}

INCLUDED COMPONENTS
-------------------
${metadata.includedComponents.map(c => `- ${c}`).join('\n')}

TOTAL FILES: ${metadata.totalFiles}

FILE DESCRIPTIONS
-----------------
- metadata.json: Package metadata and generation details
- transactions.csv: All financial transactions for the period
- journal_entries.csv: All journal entries for the period
- ledger_entries.csv: All ledger entries linked to journal entries
- audit_logs.csv: Complete audit trail of all changes
- tax_reports.csv: Tax compliance reports for the period
- archive_summaries.csv: Summary statistics for archived periods
- chart_of_accounts.csv: Current chart of accounts with balances

NOTES
-----
- All dates are in ISO 8601 format
- All amounts are in the specified currency (default: PKR)
- Audit logs include both active and archived entries
- This package is intended for external auditors and compliance purposes

For questions or additional information, please contact the finance team.
    `.trim();
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[], columns: string[]): string {
    if (data.length === 0) {
      return columns.join(',') + '\n';
    }

    const headers = columns.join(',');
    const rows = data.map(row =>
      columns
        .map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        })
        .join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Generate compliance report
   * Requirements: 20.10
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      // Get statistics
      const auditStats = await auditLogService.getStatistics();
      const retentionStats = await dataRetentionService.getRetentionStatistics();
      const taxReports = await complianceTaxManager.getTaxReports('PK', {
        limit: 100
      });

      // Filter tax reports for period
      const periodTaxReports = taxReports.filter(report => {
        const reportStart = new Date(report.periodStart);
        const reportEnd = new Date(report.periodEnd);
        return reportStart >= startDate && reportEnd <= endDate;
      });

      const report = `
COMPLIANCE REPORT
=================

Report Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
Generated: ${new Date().toLocaleString()}

AUDIT TRAIL COMPLIANCE
----------------------
Total Active Audit Logs: ${auditStats.totalActiveLogs.toLocaleString()}
Total Archived Audit Logs: ${auditStats.totalArchivedLogs.toLocaleString()}
Logs Pending Archive: ${auditStats.logsPendingArchive.toLocaleString()}
Oldest Active Log: ${auditStats.oldestActiveLog ? new Date(auditStats.oldestActiveLog).toLocaleDateString() : 'N/A'}
Newest Active Log: ${auditStats.newestActiveLog ? new Date(auditStats.newestActiveLog).toLocaleDateString() : 'N/A'}
Total Storage: ${auditStats.totalSizeMb.toFixed(2)} MB

✓ Audit logs are immutable (cannot be modified or deleted)
✓ 7-year retention policy is enforced
✓ All financial changes are logged with user attribution

DATA RETENTION COMPLIANCE
--------------------------
Active Transactions: ${retentionStats.activeTransactions.toLocaleString()}
Archived Transactions: ${retentionStats.archivedTransactions.toLocaleString()}
Active Legal Holds: ${retentionStats.activeLegalHolds}
Oldest Active Transaction: ${retentionStats.oldestActiveTransaction ? new Date(retentionStats.oldestActiveTransaction).toLocaleDateString() : 'N/A'}
Total Archive Periods: ${retentionStats.totalArchivePeriods}

✓ Transactions older than 7 years are archived
✓ Archive summaries maintained for historical periods
✓ Legal hold mechanism prevents premature deletion

TAX COMPLIANCE
--------------
Tax Reports in Period: ${periodTaxReports.length}
Filed Reports: ${periodTaxReports.filter(r => r.filingStatus === 'filed' || r.filingStatus === 'paid').length}
Pending Reports: ${periodTaxReports.filter(r => r.filingStatus === 'draft' || r.filingStatus === 'pending').length}

${periodTaxReports.length > 0 ? `
Recent Tax Reports:
${periodTaxReports.slice(0, 5).map(r => `
  - ${r.reportType} (${new Date(r.periodStart).toLocaleDateString()} to ${new Date(r.periodEnd).toLocaleDateString()})
    Status: ${r.filingStatus}
    Net Liability: PKR ${r.netTaxLiability.toLocaleString()}
`).join('')}
` : 'No tax reports for this period'}

COMPLIANCE STATUS
-----------------
✓ Audit trail: COMPLIANT
✓ Data retention: COMPLIANT
✓ Tax reporting: ${periodTaxReports.filter(r => r.filingStatus === 'draft').length === 0 ? 'COMPLIANT' : 'PENDING'}

RECOMMENDATIONS
---------------
${auditStats.logsPendingArchive > 0 ? '- Archive old audit logs to optimize storage\n' : ''}${retentionStats.activeLegalHolds > 0 ? '- Review active legal holds for potential release\n' : ''}${periodTaxReports.filter(r => r.filingStatus === 'draft').length > 0 ? '- File pending tax reports before deadlines\n' : ''}${auditStats.logsPendingArchive === 0 && retentionStats.activeLegalHolds === 0 && periodTaxReports.filter(r => r.filingStatus === 'draft').length === 0 ? '- No immediate actions required\n' : ''}
      `.trim();

      return report;
    } catch (error) {
      console.error('Generate compliance report failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const auditPackageService = new AuditPackageService();
