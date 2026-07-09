/**
 * Bank Reconciliation Service
 * 
 * Handles bank statement import, transaction matching, and reconciliation reporting
 * 
 * Requirements: 23.1, 23.2, 23.4, 23.5, 23.6, 23.7, 23.8, 23.10
 * Tasks: 27.1, 27.2, 27.3
 */

import { supabase } from '@/integrations/supabase/client';

// =====================================================
// Types
// =====================================================

export interface BankStatement {
  id: string;
  bankName: string;
  accountNumber: string;
  statementDate: Date;
  statementPeriodStart: Date;
  statementPeriodEnd: Date;
  openingBalance: number;
  closingBalance: number;
  fileName?: string;
  fileFormat?: 'CSV' | 'OFX' | 'QBO';
  reconciliationStatus: 'pending' | 'in_progress' | 'completed' | 'discrepancy';
}

export interface BankTransaction {
  id: string;
  statementId: string;
  transactionDate: Date;
  description: string;
  referenceNumber?: string;
  amount: number;
  transactionType: 'debit' | 'credit';
  runningBalance?: number;
  matched: boolean;
  matchedLedgerEntryId?: string;
  matchConfidence?: number;
  matchMethod?: 'exact' | 'fuzzy' | 'manual';
}

export interface ReconciliationReport {
  id: string;
  statementId: string;
  reportDate: Date;
  reconciliationPeriodStart: Date;
  reconciliationPeriodEnd: Date;
  bookBalance: number;
  bankBalance: number;
  difference: number;
  totalBankTransactions: number;
  matchedTransactions: number;
  unmatchedBankTransactions: number;
  unmatchedBookTransactions: number;
  status: 'draft' | 'finalized' | 'approved';
  notes?: string;
  discrepancies?: Discrepancy[];
}

export interface Discrepancy {
  type: 'missing_bank' | 'missing_book' | 'amount_mismatch' | 'date_mismatch';
  description: string;
  bankTransactionId?: string;
  ledgerEntryId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  severity: 'low' | 'medium' | 'high';
}

export interface ImportResult {
  success: boolean;
  statementId?: string;
  transactionsImported?: number;
  error?: string;
}

export interface MatchResult {
  success: boolean;
  matchedCount?: number;
  unmatchedCount?: number;
  error?: string;
}

export interface ReconciliationResult {
  success: boolean;
  reportId?: string;
  difference?: number;
  discrepancies?: Discrepancy[];
  error?: string;
}

// =====================================================
// Bank Reconciliation Service
// =====================================================

export class BankReconciliationService {
  /**
   * Import bank statement from file
   * Supports CSV, OFX, QBO formats
   * 
   * Task: 27.1
   * Requirements: 23.1
   */
  async importBankStatement(
    file: File,
    bankName: string,
    accountNumber: string
  ): Promise<ImportResult> {
    try {
      const fileFormat = this.detectFileFormat(file.name);
      
      if (!['CSV', 'OFX', 'QBO'].includes(fileFormat)) {
        return {
          success: false,
          error: `Unsupported file format. Supported formats: CSV, OFX, QBO`,
        };
      }

      // Read file content
      const fileContent = await this.readFileContent(file);
      
      // Parse based on format
      let parsedData;
      switch (fileFormat) {
        case 'CSV':
          parsedData = await this.parseCSV(fileContent);
          break;
        case 'OFX':
          parsedData = await this.parseOFX(fileContent);
          break;
        case 'QBO':
          parsedData = await this.parseQBO(fileContent);
          break;
        default:
          return {
            success: false,
            error: `Unsupported file format: ${fileFormat}`,
          };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create bank statement record
      const { data: statement, error: statementError } = await supabase
        .from('finance_bank_statements')
        .insert({
          bank_name: bankName,
          account_number: accountNumber,
          statement_date: parsedData.statementDate,
          statement_period_start: parsedData.periodStart,
          statement_period_end: parsedData.periodEnd,
          opening_balance: parsedData.openingBalance,
          closing_balance: parsedData.closingBalance,
          file_name: file.name,
          file_format: fileFormat,
          imported_by: user.id,
        })
        .select()
        .single();

      if (statementError || !statement) {
        return {
          success: false,
          error: `Failed to create statement: ${statementError?.message}`,
        };
      }

      // Insert bank transactions
      const transactions = parsedData.transactions.map((tx: any) => ({
        statement_id: statement.id,
        transaction_date: tx.date,
        description: tx.description,
        reference_number: tx.reference,
        amount: Math.abs(tx.amount),
        transaction_type: tx.amount >= 0 ? 'credit' : 'debit',
        running_balance: tx.balance,
      }));

      const { error: transactionsError } = await supabase
        .from('finance_bank_transactions')
        .insert(transactions);

      if (transactionsError) {
        return {
          success: false,
          error: `Failed to import transactions: ${transactionsError.message}`,
        };
      }

      return {
        success: true,
        statementId: statement.id,
        transactionsImported: transactions.length,
      };
    } catch (error) {
      console.error('Error importing bank statement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Match bank transactions with ledger entries
   * Uses amount and date for matching with fuzzy matching support
   * 
   * Task: 27.2
   * Requirements: 23.2, 23.7
   */
  async matchTransactions(statementId: string): Promise<MatchResult> {
    try {
      // Get unmatched bank transactions
      const { data: bankTransactions, error: bankError } = await supabase
        .from('finance_bank_transactions')
        .select('*')
        .eq('statement_id', statementId)
        .eq('matched', false);

      if (bankError || !bankTransactions) {
        return {
          success: false,
          error: `Failed to fetch bank transactions: ${bankError?.message}`,
        };
      }

      // Get unmatched ledger entries
      const { data: ledgerEntries, error: ledgerError } = await supabase
        .from('finance_ledger_entries')
        .select('*')
        .is('matched_bank_transaction_id', null);

      if (ledgerError || !ledgerEntries) {
        return {
          success: false,
          error: `Failed to fetch ledger entries: ${ledgerError?.message}`,
        };
      }

      let matchedCount = 0;

      // Attempt to match each bank transaction
      for (const bankTx of bankTransactions) {
        const match = this.findBestMatch(bankTx, ledgerEntries);
        
        if (match) {
          // Match found - update bank transaction
          const { error: matchError } = await supabase.rpc(
            'match_bank_transaction',
            {
              p_bank_transaction_id: bankTx.id,
              p_ledger_entry_id: match.ledgerEntry.id,
              p_match_method: match.method,
              p_confidence: match.confidence,
            }
          );

          if (!matchError) {
            matchedCount++;
          }
        }
      }

      const unmatchedCount = bankTransactions.length - matchedCount;

      return {
        success: true,
        matchedCount,
        unmatchedCount,
      };
    } catch (error) {
      console.error('Error matching transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate reconciliation report
   * Identifies matched and unmatched transactions
   * Calculates reconciliation difference
   * Flags discrepancies for investigation
   * 
   * Task: 27.3
   * Requirements: 23.4, 23.5, 23.6, 23.8
   */
  async generateReconciliationReport(
    statementId: string
  ): Promise<ReconciliationResult> {
    try {
      // Get statement details
      const { data: statement, error: statementError } = await supabase
        .from('finance_bank_statements')
        .select('*')
        .eq('id', statementId)
        .single();

      if (statementError || !statement) {
        return {
          success: false,
          error: `Failed to fetch statement: ${statementError?.message}`,
        };
      }

      // Calculate reconciliation difference
      const { data: reconciliationData, error: reconciliationError } =
        await supabase.rpc('calculate_reconciliation_difference', {
          p_statement_id: statementId,
        });

      if (reconciliationError || !reconciliationData || reconciliationData.length === 0) {
        return {
          success: false,
          error: `Failed to calculate reconciliation: ${reconciliationError?.message}`,
        };
      }

      const recon = reconciliationData[0];

      // Identify discrepancies
      const discrepancies = await this.identifyDiscrepancies(statementId);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create reconciliation report
      const { data: report, error: reportError } = await supabase
        .from('finance_reconciliation_reports')
        .insert({
          statement_id: statementId,
          report_date: new Date().toISOString().split('T')[0],
          reconciliation_period_start: statement.statement_period_start,
          reconciliation_period_end: statement.statement_period_end,
          book_balance: recon.book_balance,
          bank_balance: recon.bank_balance,
          difference: recon.difference,
          total_bank_transactions: recon.matched_count + recon.unmatched_bank_count,
          matched_transactions: recon.matched_count,
          unmatched_bank_transactions: recon.unmatched_bank_count,
          unmatched_book_transactions: recon.unmatched_book_count,
          status: Math.abs(recon.difference) < 0.01 ? 'finalized' : 'draft',
          discrepancies: discrepancies,
          created_by: user.id,
        })
        .select()
        .single();

      if (reportError || !report) {
        return {
          success: false,
          error: `Failed to create report: ${reportError?.message}`,
        };
      }

      // Update statement status
      const newStatus =
        Math.abs(recon.difference) < 0.01
          ? 'completed'
          : discrepancies.length > 0
          ? 'discrepancy'
          : 'in_progress';

      await supabase
        .from('finance_bank_statements')
        .update({ reconciliation_status: newStatus })
        .eq('id', statementId);

      return {
        success: true,
        reportId: report.id,
        difference: recon.difference,
        discrepancies,
      };
    } catch (error) {
      console.error('Error generating reconciliation report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private detectFileFormat(fileName: string): string {
    const extension = fileName.split('.').pop()?.toUpperCase() || '';
    return extension;
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  private async parseCSV(content: string): Promise<any> {
    const lines = content.split('\n').filter((line) => line.trim());
    const headers = lines[0].split(',').map((h) => h.trim());
    
    const transactions = [];
    let openingBalance = 0;
    let closingBalance = 0;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const tx: any = {};
      
      headers.forEach((header, index) => {
        tx[header.toLowerCase()] = values[index];
      });

      const date = new Date(tx.date || tx.transaction_date);
      const amount = parseFloat(tx.amount || tx.debit || tx.credit || '0');
      const balance = parseFloat(tx.balance || tx.running_balance || '0');

      if (!periodStart || date < periodStart) periodStart = date;
      if (!periodEnd || date > periodEnd) periodEnd = date;

      transactions.push({
        date,
        description: tx.description || tx.memo || '',
        reference: tx.reference || tx.check_number || '',
        amount,
        balance,
      });

      if (i === 1) openingBalance = balance - amount;
      if (i === lines.length - 1) closingBalance = balance;
    }

    return {
      statementDate: periodEnd || new Date(),
      periodStart: periodStart || new Date(),
      periodEnd: periodEnd || new Date(),
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  private async parseOFX(content: string): Promise<any> {
    // Simplified OFX parsing - in production, use a proper OFX parser library
    const transactions: any[] = [];
    
    // Extract transactions using regex (simplified)
    const txPattern = /<STMTTRN>(.*?)<\/STMTTRN>/gs;
    const matches = content.matchAll(txPattern);
    
    for (const match of matches) {
      const txContent = match[1];
      const date = this.extractOFXValue(txContent, 'DTPOSTED');
      const amount = this.extractOFXValue(txContent, 'TRNAMT');
      const memo = this.extractOFXValue(txContent, 'MEMO');
      const fitid = this.extractOFXValue(txContent, 'FITID');
      
      transactions.push({
        date: this.parseOFXDate(date),
        description: memo,
        reference: fitid,
        amount: parseFloat(amount),
        balance: 0, // OFX doesn't always include running balance
      });
    }

    const openingBalance = parseFloat(this.extractOFXValue(content, 'BALAMT')) || 0;
    const closingBalance = openingBalance + transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      statementDate: new Date(),
      periodStart: transactions[0]?.date || new Date(),
      periodEnd: transactions[transactions.length - 1]?.date || new Date(),
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  private async parseQBO(content: string): Promise<any> {
    // QBO is similar to OFX format
    return this.parseOFX(content);
  }

  private extractOFXValue(content: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([^<]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private parseOFXDate(dateStr: string): Date {
    // OFX date format: YYYYMMDDHHMMSS
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  private findBestMatch(
    bankTx: any,
    ledgerEntries: any[]
  ): { ledgerEntry: any; method: 'exact' | 'fuzzy' | 'manual'; confidence: number } | null {
    // Exact match: same amount and date
    for (const entry of ledgerEntries) {
      if (
        Math.abs(entry.debit - entry.credit) === bankTx.amount &&
        new Date(entry.transaction_date).toDateString() ===
          new Date(bankTx.transaction_date).toDateString()
      ) {
        return {
          ledgerEntry: entry,
          method: 'exact',
          confidence: 100,
        };
      }
    }

    // Fuzzy match: same amount, date within 3 days
    for (const entry of ledgerEntries) {
      const amountMatch = Math.abs(entry.debit - entry.credit) === bankTx.amount;
      const dateDiff = Math.abs(
        new Date(entry.transaction_date).getTime() -
          new Date(bankTx.transaction_date).getTime()
      );
      const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

      if (amountMatch && daysDiff <= 3) {
        const confidence = 100 - daysDiff * 10; // Reduce confidence by 10% per day
        return {
          ledgerEntry: entry,
          method: 'fuzzy',
          confidence,
        };
      }
    }

    return null;
  }

  private async identifyDiscrepancies(statementId: string): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];

    // Get unmatched bank transactions
    const { data: unmatchedBank } = await supabase
      .from('finance_bank_transactions')
      .select('*')
      .eq('statement_id', statementId)
      .eq('matched', false);

    if (unmatchedBank) {
      for (const tx of unmatchedBank) {
        discrepancies.push({
          type: 'missing_book',
          description: `Bank transaction not found in books: ${tx.description}`,
          bankTransactionId: tx.id,
          actualAmount: tx.amount,
          severity: tx.amount > 1000 ? 'high' : tx.amount > 100 ? 'medium' : 'low',
        });
      }
    }

    return discrepancies;
  }
}

// Export singleton instance
export const bankReconciliationService = new BankReconciliationService();
