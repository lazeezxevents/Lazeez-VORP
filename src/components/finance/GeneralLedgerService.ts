import { supabase } from "@/integrations/supabase/client";
import { auditLogService } from "./AuditLogService";
import type {
  JournalEntryResult,
  TransactionResult,
  Balance,
  TrialBalance,
  CreateJournalEntryInput,
  JournalEntryWithLines,
  PostingResult,
} from "./types";

/**
 * GeneralLedger Service Class
 * 
 * Provides core accounting functionality including:
 * - Journal entry creation with balance validation
 * - Transaction posting with atomic operations
 * - Account balance queries with caching
 * - Trial balance generation
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.7
 */
export class GeneralLedgerService {
  private balanceCache: Map<string, { balance: Balance; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  /**
   * Create a new journal entry with validation
   * Validates that debits equal credits before creating
   * 
   * Requirement 1.2: Validate sum of debits equals sum of credits
   */
  async createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntryResult> {
    try {
      // Validate balance
      const totalDebits = input.ledger_entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = input.ledger_entries.reduce((sum, entry) => sum + entry.credit, 0);

      if (Math.abs(totalDebits - totalCredits) >= 0.01) {
        return {
          success: false,
          error: `Journal entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Generate entry number
      const { data: entryNumber, error: numberError } = await supabase
        .rpc('generate_journal_entry_number');

      if (numberError) {
        console.error("Error generating entry number:", numberError);
        return { success: false, error: "Failed to generate entry number" };
      }

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from("finance_journal_entries")
        .insert({
          entry_number: entryNumber,
          entry_date: input.entry_date,
          description: input.description || null,
          reference: input.reference || null,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (journalError) {
        console.error("Error creating journal entry:", journalError);
        return { success: false, error: journalError.message };
      }

      // Create ledger entries
      const ledgerEntries = input.ledger_entries.map(entry => ({
        journal_entry_id: journalEntry.id,
        account_id: entry.account_id,
        debit: entry.debit,
        credit: entry.credit,
        currency: 'PKR', // PKR only
        description: entry.description || null,
      }));

      const { data: createdLedgerEntries, error: ledgerError } = await supabase
        .from("finance_ledger_entries")
        .insert(ledgerEntries)
        .select();

      if (ledgerError) {
        console.error("Error creating ledger entries:", ledgerError);
        // Rollback journal entry
        await supabase.from("finance_journal_entries").delete().eq("id", journalEntry.id);
        return { success: false, error: ledgerError.message };
      }

      const result: JournalEntryWithLines = {
        ...journalEntry,
        ledger_entries: createdLedgerEntries,
      };

      // Log audit entry for journal entry creation
      await auditLogService.logAuditEntry({
        entityType: 'journal_entry',
        entityId: journalEntry.id,
        action: 'create',
        oldValues: null,
        newValues: {
          entry_number: journalEntry.entry_number,
          entry_date: journalEntry.entry_date,
          description: journalEntry.description,
          status: journalEntry.status,
          ledger_entries_count: createdLedgerEntries.length,
        },
      });

      return { success: true, journal_entry: result };
    } catch (error) {
      console.error("Unexpected error creating journal entry:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post a transaction and create corresponding journal entry
   * Uses atomic operations to ensure data consistency
   * 
   * Requirement 1.3: Update all affected account balances atomically
   * Requirement 1.7: Rollback all partial changes on failure
   */
  async postTransaction(
    journalEntryId: string,
    userId: string
  ): Promise<PostingResult> {
    try {
      // Call database function for atomic posting
      const { data, error } = await supabase.rpc('post_journal_entry', {
        p_journal_entry_id: journalEntryId,
        p_posted_by: userId,
      });

      if (error) {
        console.error("Error posting journal entry:", error);
        return { success: false, error: error.message };
      }

      // Clear balance cache for affected accounts
      this.clearBalanceCache();

      // Log audit entry for transaction posting
      await auditLogService.logAuditEntry({
        entityType: 'journal_entry',
        entityId: journalEntryId,
        action: 'post',
        oldValues: { status: 'draft' },
        newValues: { 
          status: 'posted',
          posted_by: userId,
          accounts_updated: data || 0,
        },
      });

      return {
        success: true,
        journal_entry_id: journalEntryId,
        accounts_updated: data || 0,
      };
    } catch (error) {
      console.error("Unexpected error posting transaction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post an invoice to the general ledger by calling the DB RPC `journalize_invoice`.
   * Returns posting result with journal_entry_id on success.
   */
  async postInvoiceToLedger(invoiceId: string, userId: string): Promise<PostingResult> {
    try {
      const { data, error } = await supabase.rpc('journalize_invoice', {
        p_invoice_id: invoiceId,
        p_posted_by: userId,
      });

      if (error) {
        console.error('Error posting invoice to ledger:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.success !== true) {
        return { success: false, error: data?.error || 'Unknown RPC error' };
      }

      // Clear cache and audit
      this.clearBalanceCache();
      await auditLogService.logAuditEntry({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'post_to_ledger',
        oldValues: null,
        newValues: { journal_entry_id: data.journal_entry_id },
      });

      return { success: true, journal_entry_id: data.journal_entry_id } as PostingResult;
    } catch (error) {
      console.error('Unexpected error in postInvoiceToLedger:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Post a payment to the general ledger by calling the DB RPC `journalize_payment`.
   */
  async postPaymentToLedger(
    invoiceId: string,
    paymentAmount: number,
    paymentDate: Date,
    userId: string
  ): Promise<PostingResult> {
    try {
      const paymentDateStr = paymentDate.toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('journalize_payment', {
        p_invoice_id: invoiceId,
        p_payment_amount: paymentAmount,
        p_payment_date: paymentDateStr,
        p_posted_by: userId,
      });

      if (error) {
        console.error('Error posting payment to ledger:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.success !== true) {
        return { success: false, error: data?.error || 'Unknown RPC error' };
      }

      this.clearBalanceCache();
      await auditLogService.logAuditEntry({
        entityType: 'invoice_payment',
        entityId: invoiceId,
        action: 'post_to_ledger',
        oldValues: null,
        newValues: { journal_entry_id: data.journal_entry_id, amount: paymentAmount },
      });

      return { success: true, journal_entry_id: data.journal_entry_id } as PostingResult;
    } catch (error) {
      console.error('Unexpected error in postPaymentToLedger:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get account balance with caching
   * 
   * Requirement 1.5: Return account balance within 100ms
   */
  async getAccountBalance(accountId: string, date?: Date): Promise<Balance | null> {
    try {
      const cacheKey = `${accountId}-${date?.toISOString() || 'current'}`;
      
      // Check cache
      const cached = this.balanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.balance;
      }

      // Fetch account
      const { data: account, error: accountError } = await supabase
        .from("finance_accounts")
        .select("id, code, name, balance, currency")
        .eq("id", accountId)
        .single();

      if (accountError || !account) {
        console.error("Error fetching account:", accountError);
        return null;
      }

      // If date is specified, calculate historical balance
      let balance = account.balance;
      if (date) {
        const { data: entries, error: entriesError } = await supabase
          .from("finance_ledger_entries")
          .select(`
            debit,
            credit,
            finance_journal_entries!inner(entry_date, status)
          `)
          .eq("account_id", accountId)
          .eq("finance_journal_entries.status", "posted")
          .lte("finance_journal_entries.entry_date", date.toISOString().split('T')[0]);

        if (entriesError) {
          console.error("Error fetching ledger entries:", entriesError);
          return null;
        }

        balance = entries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
      }

      const result: Balance = {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        balance,
        currency: account.currency,
        as_of_date: date?.toISOString() || new Date().toISOString(),
      };

      // Cache result
      this.balanceCache.set(cacheKey, { balance: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error("Unexpected error getting account balance:", error);
      return null;
    }
  }

  /**
   * Generate trial balance for a date range
   * Shows all accounts with their debit/credit balances
   */
  async getTrialBalance(startDate: Date, endDate: Date): Promise<TrialBalance | null> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch all accounts
      const { data: accounts, error: accountsError } = await supabase
        .from("finance_accounts")
        .select("id, code, name, type")
        .eq("is_active", true)
        .order("code");

      if (accountsError) {
        console.error("Error fetching accounts:", accountsError);
        return null;
      }

      // Fetch ledger entries for the period
      const { data: entries, error: entriesError } = await supabase
        .from("finance_ledger_entries")
        .select(`
          account_id,
          debit,
          credit,
          finance_journal_entries!inner(entry_date, status)
        `)
        .eq("finance_journal_entries.status", "posted")
        .gte("finance_journal_entries.entry_date", startDateStr)
        .lte("finance_journal_entries.entry_date", endDateStr);

      if (entriesError) {
        console.error("Error fetching ledger entries:", entriesError);
        return null;
      }

      // Calculate balances per account
      const accountBalances = new Map<string, { debit: number; credit: number }>();
      
      entries.forEach(entry => {
        const current = accountBalances.get(entry.account_id) || { debit: 0, credit: 0 };
        accountBalances.set(entry.account_id, {
          debit: current.debit + entry.debit,
          credit: current.credit + entry.credit,
        });
      });

      // Build trial balance
      const trialBalanceAccounts = accounts.map(account => {
        const balances = accountBalances.get(account.id) || { debit: 0, credit: 0 };
        return {
          account_id: account.id,
          account_code: account.code,
          account_name: account.name,
          account_type: account.type,
          debit: balances.debit,
          credit: balances.credit,
        };
      }).filter(account => account.debit !== 0 || account.credit !== 0);

      const totalDebits = trialBalanceAccounts.reduce((sum, acc) => sum + acc.debit, 0);
      const totalCredits = trialBalanceAccounts.reduce((sum, acc) => sum + acc.credit, 0);

      return {
        start_date: startDateStr,
        end_date: endDateStr,
        accounts: trialBalanceAccounts,
        total_debits: totalDebits,
        total_credits: totalCredits,
        is_balanced: Math.abs(totalDebits - totalCredits) < 0.01,
      };
    } catch (error) {
      console.error("Unexpected error generating trial balance:", error);
      return null;
    }
  }

  /**
   * Clear balance cache
   */
  private clearBalanceCache(): void {
    this.balanceCache.clear();
  }

  /**
   * Validate journal entry balance
   */
  async validateJournalEntryBalance(journalEntryId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('validate_journal_entry_balance', {
        p_journal_entry_id: journalEntryId,
      });

      if (error) {
        console.error("Error validating balance:", error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error("Unexpected error validating balance:", error);
      return false;
    }
  }
}

// Export singleton instance
export const generalLedgerService = new GeneralLedgerService();
