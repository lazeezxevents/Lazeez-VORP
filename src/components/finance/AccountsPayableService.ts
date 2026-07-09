import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput } from "./types";

/**
 * Accounts Payable Service Class
 * 
 * Manages vendor bills, expense approvals, payment scheduling, and vendor payouts including:
 * - Creating and managing bills for vendor invoices
 * - Expense approval workflows
 * - Payment scheduling based on due dates
 * - Vendor payout processing with upfront and commission deductions
 * 
 * Requirements: 8.1, 8.3, 6.1, 6.2, 6.3, 6.4, 6.5
 * Task: 17.2 Create AccountsPayable service class
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  bill_date: Date;
  due_date: Date;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  currency: 'PKR';
  notes?: string;
  approval_chain?: Approval[];
}

export interface BillLineItem {
  id: string;
  bill_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

export interface Approval {
  approver_id: string;
  approver_name: string;
  approved_at: Date;
  notes?: string;
}

export interface ScheduledPayment {
  id: string;
  bill_id: string;
  vendor_id: string;
  payment_date: Date;
  amount: number;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  payment_method?: string;
  notes?: string;
}

export interface PayoutResult {
  vendor_id: string;
  order_id: string;
  payout_amount: number;
  upfront_amount: number;
  remaining_amount: number;
  commission_deducted: number;
  net_payout: number;
  payment_method: string;
  transaction_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BillData {
  vendor_id: string;
  bill_date: Date;
  due_date: Date;
  line_items: Omit<BillLineItem, 'id' | 'bill_id'>[];
  notes?: string;
}

export interface BillResult {
  success: boolean;
  bill?: Bill;
  error?: string;
}

export interface ApprovalResult {
  success: boolean;
  expense_id?: string;
  new_status?: string;
  error?: string;
}

export interface ScheduledPaymentResult {
  success: boolean;
  scheduled_payment?: ScheduledPayment;
  error?: string;
}

export interface PayoutProcessResult {
  success: boolean;
  payout?: PayoutResult;
  error?: string;
}

// =====================================================
// Accounts Payable Service
// =====================================================

export class AccountsPayableService {
  /**
   * Create a bill for vendor invoice
   * 
   * Requirement 8.1: Create bills with unique bill numbers for vendor invoices
   * Requirement 8.2: Calculate total amount including line items and taxes
   */
  async createBill(billData: BillData): Promise<BillResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Validate vendor exists
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('id', billData.vendor_id)
        .single();

      if (vendorError || !vendor) {
        return { success: false, error: "Vendor not found" };
      }

      // Calculate totals
      const subtotal = billData.line_items.reduce((sum, item) => sum + item.amount, 0);
      const tax_amount = billData.line_items.reduce(
        (sum, item) => sum + (item.amount * item.tax_rate / 100),
        0
      );
      const total_amount = subtotal + tax_amount;

      // Generate bill number
      const bill_number = `BILL-${Date.now()}`;

      // Create bill record (would need a bills table - using a placeholder approach)
      // For now, we'll create a journal entry and track in audit log
      
      // Record bill in general ledger as accounts payable
      const ledgerResult = await this.recordBillInLedger(
        billData.vendor_id,
        total_amount,
        bill_number,
        billData.bill_date
      );

      if (!ledgerResult.success) {
        return {
          success: false,
          error: ledgerResult.error || "Failed to record bill in ledger",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'bill',
        entityId: bill_number,
        action: 'create',
        oldValues: null,
        newValues: {
          bill_number,
          vendor_id: billData.vendor_id,
          vendor_name: vendor.name,
          total_amount,
          status: 'pending',
          due_date: billData.due_date.toISOString(),
        },
      });

      const bill: Bill = {
        id: bill_number,
        bill_number,
        vendor_id: billData.vendor_id,
        bill_date: billData.bill_date,
        due_date: billData.due_date,
        subtotal,
        tax_amount,
        total_amount,
        amount_paid: 0,
        status: 'pending',
        currency: 'PKR',
        notes: billData.notes,
        approval_chain: [],
      };

      return { success: true, bill };
    } catch (error) {
      console.error("Unexpected error creating bill:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Approve an expense
   * 
   * Requirement 9.5: Approve expenses and update status
   * Requirement 9.4: Route expenses through approval workflows
   */
  async approveExpense(
    expenseId: string,
    approverId: string,
    notes?: string
  ): Promise<ApprovalResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Verify approver is the current user
      if (user.id !== approverId) {
        return { success: false, error: "Unauthorized: You can only approve as yourself" };
      }

      // Get expense details (would need finance_expenses table)
      // For now, we'll use audit log to track approval
      
      // Log approval in audit log
      await auditLogService.logAuditEntry({
        entityType: 'expense',
        entityId: expenseId,
        action: 'approve',
        oldValues: { status: 'pending_approval' },
        newValues: {
          status: 'approved',
          approver_id: approverId,
          approved_at: new Date().toISOString(),
          notes: notes || null,
        },
      });

      // Create notification for expense submitter
      // This would integrate with the notification system

      return {
        success: true,
        expense_id: expenseId,
        new_status: 'approved',
      };
    } catch (error) {
      console.error("Unexpected error approving expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Schedule a payment for a bill
   * 
   * Requirement 8.3: Schedule payments based on due dates
   * Requirement 8.6: Generate payment schedules
   */
  async schedulePayment(
    billId: string,
    paymentDate: Date,
    paymentMethod?: string,
    notes?: string
  ): Promise<ScheduledPaymentResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Validate payment date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledDate = new Date(paymentDate);
      scheduledDate.setHours(0, 0, 0, 0);

      if (scheduledDate < today) {
        return { success: false, error: "Payment date cannot be in the past" };
      }

      // Create scheduled payment record
      const scheduledPaymentId = `SCHED-${Date.now()}`;

      // Log scheduled payment in audit log
      await auditLogService.logAuditEntry({
        entityType: 'scheduled_payment',
        entityId: scheduledPaymentId,
        action: 'schedule',
        oldValues: null,
        newValues: {
          scheduled_payment_id: scheduledPaymentId,
          bill_id: billId,
          payment_date: paymentDate.toISOString(),
          payment_method: paymentMethod || 'bank_transfer',
          status: 'scheduled',
          notes: notes || null,
        },
      });

      const scheduledPayment: ScheduledPayment = {
        id: scheduledPaymentId,
        bill_id: billId,
        vendor_id: '', // Would be fetched from bill
        payment_date: paymentDate,
        amount: 0, // Would be fetched from bill
        status: 'scheduled',
        payment_method: paymentMethod || 'bank_transfer',
        notes,
      };

      return { success: true, scheduled_payment: scheduledPayment };
    } catch (error) {
      console.error("Unexpected error scheduling payment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process vendor payout for completed order
   * 
   * Requirement 6.1: Calculate net payout as remaining amount minus commission
   * Requirement 6.2: Deduct upfront payment percentage from total payout
   * Requirement 6.3: Deduct vendor commission from remaining amount
   * Requirement 6.4: Ensure net payout is non-negative
   * Requirement 6.5: Create journal entries for payout
   */
  async processVendorPayout(
    vendorId: string,
    orderId: string
  ): Promise<PayoutProcessResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get order financial data
      const { data: orderData, error: orderError } = await supabase
        .from('finance_order_data')
        .select('*')
        .eq('order_id', orderId)
        .eq('vendor_id', vendorId)
        .single();

      if (orderError || !orderData) {
        return { success: false, error: "Order financial data not found" };
      }

      // Validate payout hasn't been processed already
      if (orderData.payout_status === 'completed') {
        return { success: false, error: "Payout already processed for this order" };
      }

      // Get vendor financial profile for payment method
      const { data: vendorProfile } = await supabase
        .from('finance_vendor_profiles')
        .select('preferred_payment_method')
        .eq('vendor_id', vendorId)
        .single();

      const paymentMethod = vendorProfile?.preferred_payment_method || 'bank_transfer';

      // Calculate payout amounts (already calculated in order data)
      const upfront_amount = orderData.upfront_amount;
      const remaining_amount = orderData.remaining_amount;
      const commission_deducted = orderData.commission_amount;
      const net_payout = orderData.net_payout;

      // Validate net payout is non-negative (Requirement 6.4)
      if (net_payout < 0) {
        return {
          success: false,
          error: "Net payout cannot be negative. Commission exceeds remaining amount.",
        };
      }

      // Record payout in general ledger
      const ledgerResult = await this.recordPayoutInLedger(
        vendorId,
        net_payout,
        orderId,
        orderData.order_number
      );

      if (!ledgerResult.success) {
        return {
          success: false,
          error: ledgerResult.error || "Failed to record payout in ledger",
        };
      }

      // Update order payout status
      const { error: updateError } = await supabase
        .from('finance_order_data')
        .update({
          payout_status: 'completed',
          remaining_paid: true,
          remaining_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.id);

      if (updateError) {
        console.error("Failed to update order payout status:", updateError);
        // Continue anyway as ledger entry was successful
      }

      // Update vendor financial profile
      const { error: profileError } = await supabase
        .from('finance_vendor_profiles')
        .update({
          total_payouts: supabase.rpc('increment', { x: net_payout }),
          last_payout_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('vendor_id', vendorId);

      if (profileError) {
        console.error("Failed to update vendor profile:", profileError);
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'vendor_payout',
        entityId: orderId,
        action: 'process_payout',
        oldValues: {
          payout_status: orderData.payout_status,
        },
        newValues: {
          vendor_id: vendorId,
          order_id: orderId,
          order_number: orderData.order_number,
          upfront_amount,
          remaining_amount,
          commission_deducted,
          net_payout,
          payment_method: paymentMethod,
          payout_status: 'completed',
          transaction_id: ledgerResult.journalEntryId,
        },
      });

      // Create notification for vendor
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'payout_completed',
          title: 'Vendor payout processed',
          message: `Payout of ₨${net_payout.toLocaleString()} processed for order ${orderData.order_number}`,
          metadata: {
            vendor_id: vendorId,
            order_id: orderId,
            order_number: orderData.order_number,
            net_payout,
            category: 'finance',
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

      const payout: PayoutResult = {
        vendor_id: vendorId,
        order_id: orderId,
        payout_amount: orderData.order_amount,
        upfront_amount,
        remaining_amount,
        commission_deducted,
        net_payout,
        payment_method: paymentMethod,
        transaction_id: ledgerResult.journalEntryId,
        status: 'completed',
      };

      return { success: true, payout };
    } catch (error) {
      console.error("Unexpected error processing vendor payout:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get bills by vendor
   * 
   * Helper method to retrieve all bills for a specific vendor
   */
  async getBillsByVendor(vendorId: string): Promise<Bill[]> {
    try {
      // This would query a bills table when implemented
      // For now, return empty array
      console.log(`Getting bills for vendor: ${vendorId}`);
      return [];
    } catch (error) {
      console.error("Error getting bills by vendor:", error);
      return [];
    }
  }

  /**
   * Get payment schedule
   * 
   * Requirement 8.6: Generate payment schedules showing upcoming payments
   */
  async getPaymentSchedule(
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledPayment[]> {
    try {
      // This would query scheduled payments table when implemented
      // For now, return empty array
      console.log(`Getting payment schedule from ${startDate} to ${endDate}`);
      return [];
    } catch (error) {
      console.error("Error getting payment schedule:", error);
      return [];
    }
  }

  /**
   * Record bill in general ledger
   * 
   * @private
   */
  private async recordBillInLedger(
    vendorId: string,
    amount: number,
    billNumber: string,
    billDate: Date
  ): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get account IDs
      const { data: expenseAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('type', 'expense')
        .eq('is_active', true)
        .limit(1)
        .single();

      const { data: apAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('type', 'liability')
        .ilike('name', '%payable%')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!expenseAccount || !apAccount) {
        return { success: false, error: "Required accounts not found" };
      }

      // Create journal entry for bill
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: billDate.toISOString().split('T')[0],
        description: `Bill received - ${billNumber}`,
        reference: billNumber,
        ledger_entries: [
          {
            account_id: expenseAccount.id,
            debit: amount,
            credit: 0,
            currency: 'PKR',
            description: 'Expense incurred',
          },
          {
            account_id: apAccount.id,
            debit: 0,
            credit: amount,
            currency: 'PKR',
            description: 'Accounts payable increase',
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
      console.error("Unexpected error recording bill in ledger:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record payout in general ledger
   * 
   * @private
   */
  private async recordPayoutInLedger(
    vendorId: string,
    amount: number,
    orderId: string,
    orderNumber: string
  ): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get account IDs
      const { data: apAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('type', 'liability')
        .ilike('name', '%payable%')
        .eq('is_active', true)
        .limit(1)
        .single();

      const { data: cashAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('code', '1010') // Cash account
        .eq('is_active', true)
        .single();

      if (!apAccount || !cashAccount) {
        return { success: false, error: "Required accounts not found" };
      }

      // Create journal entry for payout
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Vendor payout - Order: ${orderNumber}`,
        reference: `PAYOUT-${orderNumber}`,
        ledger_entries: [
          {
            account_id: apAccount.id,
            debit: amount,
            credit: 0,
            currency: 'PKR',
            description: 'Accounts payable reduction',
          },
          {
            account_id: cashAccount.id,
            debit: 0,
            credit: amount,
            currency: 'PKR',
            description: 'Cash paid to vendor',
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
      console.error("Unexpected error recording payout in ledger:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const accountsPayableService = new AccountsPayableService();
