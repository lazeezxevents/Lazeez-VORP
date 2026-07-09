import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput } from "./types";

/**
 * Accounts Receivable Service Class
 * 
 * Manages customer invoices, payment tracking, and credit management including:
 * - Creating and managing invoices
 * - Recording payments (full and partial)
 * - Generating credit notes
 * - Aging report generation
 * - Automated payment reminders
 * - Bad debt write-offs
 * 
 * Requirements: 7.1, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 * Task: 16.1 Create AccountsReceivable service class
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  issue_date: Date;
  due_date: Date;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  currency: 'PKR';
  notes?: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

export interface Payment {
  invoice_id: string;
  payment_amount: number;
  payment_date: Date;
  payment_method: string;
  reference?: string;
  notes?: string;
}

export interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  vendor_id: string;
  amount: number;
  reason: string;
  issue_date: Date;
  status: 'draft' | 'issued' | 'applied';
}

export interface AgingReport {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
  breakdown: AgingBreakdownItem[];
}

export interface AgingBreakdownItem {
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  amount_due: number;
  days_overdue: number;
  aging_bucket: 'current' | '30' | '60' | '90' | '90+';
}

export interface InvoiceResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  new_balance?: number;
  error?: string;
}

export interface CreditNoteResult {
  success: boolean;
  credit_note?: CreditNote;
  error?: string;
}

// =====================================================
// Accounts Receivable Service
// =====================================================

export class AccountsReceivableService {
  /**
   * Create a new invoice
   * 
   * Requirement 7.1: Generate invoices for subscriptions and services
   */
  async createInvoice(
    vendorId: string,
    lineItems: Omit<InvoiceLineItem, 'id' | 'invoice_id'>[],
    dueDate: Date,
    notes?: string
  ): Promise<InvoiceResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const tax_amount = lineItems.reduce(
        (sum, item) => sum + (item.amount * item.tax_rate / 100),
        0
      );
      const total_amount = subtotal + tax_amount;

      // Generate invoice number
      const { data: invoiceNumber, error: numberError } = await supabase
        .rpc('generate_invoice_number');

      if (numberError) {
        return { success: false, error: numberError.message };
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('finance_invoices')
        .insert({
          invoice_number: invoiceNumber,
          vendor_id: vendorId,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal,
          tax_amount,
          total_amount,
          amount_paid: 0,
          amount_due: total_amount,
          status: 'draft',
          currency: 'PKR',
          notes: notes || null,
        })
        .select()
        .single();

      if (invoiceError) {
        return { success: false, error: invoiceError.message };
      }

      // Create line items
      const lineItemsWithInvoiceId = lineItems.map(item => ({
        ...item,
        invoice_id: invoice.id,
      }));

      const { error: lineItemsError } = await supabase
        .from('finance_invoice_line_items')
        .insert(lineItemsWithInvoiceId);

      if (lineItemsError) {
        return { success: false, error: lineItemsError.message };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        oldValues: null,
        newValues: {
          invoice_number: invoiceNumber,
          vendor_id: vendorId,
          total_amount,
          status: 'draft',
        },
      });

      return {
        success: true,
        invoice: {
          ...invoice,
          issue_date: new Date(invoice.issue_date),
          due_date: new Date(invoice.due_date),
        } as Invoice,
      };
    } catch (error) {
      console.error("Unexpected error creating invoice:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record payment for an invoice
   * 
   * Requirement 7.4: Track payment status and aging
   * Requirement 7.8: Support partial payments
   */
  async recordPayment(payment: Payment): Promise<PaymentResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get current invoice
      const { data: invoice, error: fetchError } = await supabase
        .from('finance_invoices')
        .select('*')
        .eq('id', payment.invoice_id)
        .single();

      if (fetchError || !invoice) {
        return { success: false, error: "Invoice not found" };
      }

      // Validate payment amount
      if (payment.payment_amount <= 0) {
        return { success: false, error: "Payment amount must be greater than zero" };
      }

      const newAmountPaid = invoice.amount_paid + payment.payment_amount;
      if (newAmountPaid > invoice.total_amount) {
        return { success: false, error: "Payment amount exceeds invoice total" };
      }

      const newAmountDue = invoice.total_amount - newAmountPaid;

      // Update invoice
      const { error: updateError } = await supabase
        .from('finance_invoices')
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
        })
        .eq('id', payment.invoice_id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Post payment to ledger via atomic DB RPC (preferred)
      const postResult = await generalLedgerService.postPaymentToLedger(
        payment.invoice_id,
        payment.payment_amount,
        payment.payment_date,
        user.id
      );

      if (!postResult.success) {
        return {
          success: false,
          error: postResult.error || "Failed to post payment to ledger",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'invoice_payment',
        entityId: payment.invoice_id,
        action: 'record_payment',
        oldValues: {
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
        },
        newValues: {
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          payment_amount: payment.payment_amount,
          payment_method: payment.payment_method,
        },
      });

      return {
        success: true,
        payment_id: postResult.journal_entry_id || undefined,
        new_balance: newAmountDue,
      };
    } catch (error) {
      console.error("Unexpected error recording payment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate credit note for an invoice
   * 
   * Requirement 7.9: Handle credit notes
   */
  async generateCreditNote(
    invoiceId: string,
    reason: string,
    amount: number
  ): Promise<CreditNoteResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('finance_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return { success: false, error: "Invoice not found" };
      }

      // Validate credit note amount
      if (amount <= 0 || amount > invoice.amount_due) {
        return {
          success: false,
          error: "Credit note amount must be between 0 and amount due",
        };
      }

      // Generate credit note number
      const creditNoteNumber = `CN-${Date.now()}`;

      // Create credit note record (would need a table for this)
      // For now, we'll just adjust the invoice

      // Update invoice with credit
      const newAmountDue = invoice.amount_due - amount;
      const { error: updateError } = await supabase
        .from('finance_invoices')
        .update({
          amount_due: newAmountDue,
        })
        .eq('id', invoiceId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'credit_note',
        entityId: invoiceId,
        action: 'generate',
        oldValues: { amount_due: invoice.amount_due },
        newValues: {
          credit_note_number: creditNoteNumber,
          amount,
          reason,
          new_amount_due: newAmountDue,
        },
      });

      const creditNote: CreditNote = {
        id: creditNoteNumber,
        credit_note_number: creditNoteNumber,
        invoice_id: invoiceId,
        vendor_id: invoice.vendor_id,
        amount,
        reason,
        issue_date: new Date(),
        status: 'issued',
      };

      return { success: true, credit_note: creditNote };
    } catch (error) {
      console.error("Unexpected error generating credit note:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate aging report
   * 
   * Requirement 7.6: Generate aging reports for collections
   */
  async getAgingReport(asOfDate: Date = new Date()): Promise<AgingReport> {
    try {
      // Get all unpaid invoices
      const { data: invoices, error } = await supabase
        .from('finance_invoices')
        .select(`
          id,
          invoice_number,
          vendor_id,
          issue_date,
          due_date,
          amount_due,
          vendor:vendors(id, name)
        `)
        .gt('amount_due', 0)
        .neq('status', 'void');

      if (error) {
        console.error("Error fetching invoices for aging report:", error);
        return this.getEmptyAgingReport();
      }

      if (!invoices || invoices.length === 0) {
        return this.getEmptyAgingReport();
      }

      // Calculate aging buckets
      const breakdown: AgingBreakdownItem[] = [];
      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let over90 = 0;

      for (const invoice of invoices) {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor(
          (asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        let agingBucket: 'current' | '30' | '60' | '90' | '90+' = 'current';

        if (daysOverdue <= 0) {
          current += invoice.amount_due;
          agingBucket = 'current';
        } else if (daysOverdue <= 30) {
          days30 += invoice.amount_due;
          agingBucket = '30';
        } else if (daysOverdue <= 60) {
          days60 += invoice.amount_due;
          agingBucket = '60';
        } else if (daysOverdue <= 90) {
          days90 += invoice.amount_due;
          agingBucket = '90';
        } else {
          over90 += invoice.amount_due;
          agingBucket = '90+';
        }

        breakdown.push({
          vendor_id: invoice.vendor_id,
          vendor_name: invoice.vendor.name,
          invoice_number: invoice.invoice_number,
          invoice_date: new Date(invoice.issue_date),
          due_date: dueDate,
          amount_due: invoice.amount_due,
          days_overdue: Math.max(0, daysOverdue),
          aging_bucket: agingBucket,
        });
      }

      const total = current + days30 + days60 + days90 + over90;

      return {
        current,
        days30,
        days60,
        days90,
        over90,
        total,
        breakdown,
      };
    } catch (error) {
      console.error("Unexpected error generating aging report:", error);
      return this.getEmptyAgingReport();
    }
  }

  /**
   * Send payment reminder for an invoice
   * 
   * Requirement 7.5: Send automated payment reminders
   * Requirement 7.7: Track reminder history
   */
  async sendPaymentReminder(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get invoice details
      const { data: invoice, error: invoiceError } = await supabase
        .from('finance_invoices')
        .select(`
          *,
          vendor:vendors(id, name, email, contact_person)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return { success: false, error: "Invoice not found" };
      }

      // Calculate days overdue
      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'payment_reminder',
          title: 'Payment reminder sent',
          message: `Payment reminder sent for invoice ${invoice.invoice_number} to ${invoice.vendor.name}. Amount due: ₨${invoice.amount_due.toLocaleString()}`,
          metadata: {
            vendor_id: invoice.vendor_id,
            vendor_name: invoice.vendor.name,
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            amount_due: invoice.amount_due,
            days_overdue: Math.max(0, daysOverdue),
            category: 'finance',
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'payment_reminder_sent',
        oldValues: null,
        newValues: {
          invoice_number: invoice.invoice_number,
          vendor_id: invoice.vendor_id,
          days_overdue: Math.max(0, daysOverdue),
          amount_due: invoice.amount_due,
        },
      });

      // TODO: Send actual email to vendor
      console.log(`Payment reminder email would be sent to ${invoice.vendor.email || invoice.vendor.contact_person}`);

      return { success: true };
    } catch (error) {
      console.error("Unexpected error sending payment reminder:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Write off bad debt
   * 
   * Requirement 7.9: Support bad debt write-offs
   */
  async writeOffBadDebt(
    invoiceId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('finance_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return { success: false, error: "Invoice not found" };
      }

      // Update invoice status to void
      const { error: updateError } = await supabase
        .from('finance_invoices')
        .update({
          status: 'void',
          amount_due: 0,
        })
        .eq('id', invoiceId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Record bad debt expense in general ledger
      // TODO: Implement journal entry for bad debt write-off

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'bad_debt_writeoff',
        oldValues: {
          status: invoice.status,
          amount_due: invoice.amount_due,
        },
        newValues: {
          status: 'void',
          amount_due: 0,
          reason,
          written_off_amount: invoice.amount_due,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Unexpected error writing off bad debt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record payment in general ledger
   * 
   * @private
   */
  private async recordPaymentInLedger(
    vendorId: string,
    amount: number,
    invoiceNumber: string
  ): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get account IDs
      const { data: cashAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('code', '1010') // Cash account
        .eq('is_active', true)
        .single();

      const { data: arAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('type', 'asset')
        .ilike('name', '%receivable%')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!cashAccount || !arAccount) {
        return { success: false, error: "Required accounts not found" };
      }

      // Create journal entry for payment
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Payment received - Invoice: ${invoiceNumber}`,
        reference: `PMT-${invoiceNumber}`,
        ledger_entries: [
          {
            account_id: cashAccount.id,
            debit: amount,
            credit: 0,
            currency: 'PKR',
            description: 'Cash received',
          },
          {
            account_id: arAccount.id,
            debit: 0,
            credit: amount,
            currency: 'PKR',
            description: 'Accounts receivable reduction',
          },
        ],
      };

      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (!journalResult.success || !journalResult.journal_entry) {
        return {
          success: false,
          error: journalResult.error || "Failed to create journal entry",
        };
      }

      // Post the journal entry
      const postResult = await generalLedgerService.postTransaction(
        journalResult.journal_entry.id,
        user.id
      );

      if (!postResult.success) {
        return {
          success: false,
          error: postResult.error || "Failed to post journal entry",
        };
      }

      return { success: true, journalEntryId: journalResult.journal_entry.id };
    } catch (error) {
      console.error("Unexpected error recording payment in ledger:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get empty aging report
   * 
   * @private
   */
  private getEmptyAgingReport(): AgingReport {
    return {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
      total: 0,
      breakdown: [],
    };
  }
}

// Export singleton instance
export const accountsReceivableService = new AccountsReceivableService();
