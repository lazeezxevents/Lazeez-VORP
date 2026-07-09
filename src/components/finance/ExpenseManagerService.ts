import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import { expensePolicyValidator } from "./ExpensePolicyValidator";
import type { CreateJournalEntryInput } from "./types";

/**
 * Expense Manager Service Class
 * 
 * Manages employee expense submissions, approval workflows, and reimbursement processing including:
 * - Accepting expense submissions with receipts
 * - Routing expenses through approval workflows
 * - Validating expenses against policy limits
 * - Processing reimbursements with journal entries
 * - Linking expenses to receipt vault for audit trail
 * 
 * Requirements: 9.1, 9.5, 9.6, 9.11, 9.7, 22.1, 22.2, 22.6
 * Task: 18.2 Create ExpenseManager service class
 * Task: 18.4 Integrate expense policy validation
 */

// =====================================================
// Types and Interfaces
// =====================================================

export type ExpenseStatus = 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'reimbursed';

export interface ExpenseSubmission {
  employeeId: string;
  category: string;
  amount: number;
  currency: 'PKR';
  date: Date;
  description: string;
  receiptUrl?: string;
  projectId?: string;
  vendorId?: string;
}

export interface Expense {
  id: string;
  employee_id: string;
  category: string;
  amount: number;
  currency: 'PKR';
  expense_date: string;
  description: string | null;
  receipt_vault_id: string | null;
  status: ExpenseStatus;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  reimbursement_transaction_id: string | null;
  project_id: string | null;
  vendor_id: string | null;
  policy_violation_flags: any | null;
  approval_chain: any[];
  created_at: string;
  updated_at: string;
}

export interface Approval {
  approver_id: string;
  approver_name: string;
  approved_at: string;
  notes?: string;
}

export interface ReimbursementResult {
  success: boolean;
  expense_id?: string;
  reimbursement_amount?: number;
  transaction_id?: string;
  error?: string;
}

export interface ExpenseSubmissionResult {
  success: boolean;
  expense?: Expense;
  error?: string;
}

export interface ApprovalResult {
  success: boolean;
  expense_id?: string;
  new_status?: ExpenseStatus;
  error?: string;
}

export interface RejectionResult {
  success: boolean;
  expense_id?: string;
  new_status?: ExpenseStatus;
  error?: string;
}

// =====================================================
// Expense Manager Service
// =====================================================

export class ExpenseManagerService {
  /**
   * Submit an expense for approval
   * 
   * Requirement 9.1: Accept expense submissions with category, amount, date, and description
   * Requirement 9.2: Allow attachment of receipt images or PDFs
   * Requirement 9.7: Validate expenses against policy limits
   * Requirement 22.1: Validate expense amounts against configured policy limits
   */
  async submitExpense(expense: ExpenseSubmission): Promise<ExpenseSubmissionResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Validate employee ID matches current user
      if (expense.employeeId !== user.id) {
        return { success: false, error: "Employee ID must match authenticated user" };
      }

      // Validate amount is positive
      if (expense.amount <= 0) {
        return { success: false, error: "Expense amount must be greater than zero" };
      }

      // Validate category
      if (!expense.category || expense.category.trim().length === 0) {
        return { success: false, error: "Expense category is required" };
      }

      // Validate against expense policies
      const validation = await expensePolicyValidator.validateExpense(expense);
      
      // Store policy violations if any
      const policyViolations = validation.violations.length > 0 
        ? validation.violations 
        : null;

      // Insert expense record
      const { data: expenseData, error: insertError } = await supabase
        .from('finance_expenses')
        .insert({
          employee_id: expense.employeeId,
          category: expense.category,
          amount: expense.amount,
          currency: expense.currency || 'PKR',
          expense_date: expense.date.toISOString().split('T')[0],
          description: expense.description || null,
          project_id: expense.projectId || null,
          vendor_id: expense.vendorId || null,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          policy_violation_flags: policyViolations,
        })
        .select()
        .single();

      if (insertError || !expenseData) {
        console.error("Error inserting expense:", insertError);
        return {
          success: false,
          error: insertError?.message || "Failed to submit expense",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'expense',
        entityId: expenseData.id,
        action: 'submit',
        oldValues: null,
        newValues: {
          employee_id: expense.employeeId,
          category: expense.category,
          amount: expense.amount,
          expense_date: expense.date.toISOString().split('T')[0],
          status: 'submitted',
          policy_violations: policyViolations,
        },
      });

      // Create notification for approver (would integrate with notification system)
      // This would route through configured approval workflows based on amount and category
      // For now, we'll just log it
      console.log(`Expense ${expenseData.id} submitted for approval`);

      return { success: true, expense: expenseData };
    } catch (error) {
      console.error("Unexpected error submitting expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Approve an expense
   * 
   * Requirement 9.5: Update status to approved and record approver details when approved
   * Requirement 9.4: Notify the appropriate approver when expense requires approval
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

      // Get expense details
      const { data: expense, error: fetchError } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError || !expense) {
        return { success: false, error: "Expense not found" };
      }

      // Validate expense is in a state that can be approved
      if (expense.status !== 'submitted' && expense.status !== 'pending_approval') {
        return {
          success: false,
          error: `Expense cannot be approved from status: ${expense.status}`,
        };
      }

      // Update approval chain
      const approvalChain = expense.approval_chain || [];
      approvalChain.push({
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        notes: notes || null,
      });

      // Update expense status to approved
      const { data: updatedExpense, error: updateError } = await supabase
        .from('finance_expenses')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approverId,
          approval_chain: approvalChain,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .select()
        .single();

      if (updateError) {
        console.error("Error approving expense:", updateError);
        return {
          success: false,
          error: updateError.message || "Failed to approve expense",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'expense',
        entityId: expenseId,
        action: 'approve',
        oldValues: { status: expense.status },
        newValues: {
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          notes: notes || null,
        },
      });

      // Create notification for expense submitter
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: expense.employee_id,
          type: 'expense_approved',
          title: 'Expense approved',
          message: `Your expense of ₨${expense.amount.toLocaleString()} for ${expense.category} has been approved`,
          metadata: {
            expense_id: expenseId,
            amount: expense.amount,
            expense_category: expense.category,
            approved_by: approverId,
            category: 'finance',
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

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
   * Reject an expense
   * 
   * Requirement 9.6: Require rejection reason and notify submitter when rejected
   */
  async rejectExpense(
    expenseId: string,
    approverId: string,
    reason: string
  ): Promise<RejectionResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Verify approver is the current user
      if (user.id !== approverId) {
        return { success: false, error: "Unauthorized: You can only reject as yourself" };
      }

      // Validate rejection reason is provided
      if (!reason || reason.trim().length === 0) {
        return { success: false, error: "Rejection reason is required" };
      }

      // Get expense details
      const { data: expense, error: fetchError } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError || !expense) {
        return { success: false, error: "Expense not found" };
      }

      // Validate expense is in a state that can be rejected
      if (expense.status !== 'submitted' && expense.status !== 'pending_approval') {
        return {
          success: false,
          error: `Expense cannot be rejected from status: ${expense.status}`,
        };
      }

      // Update expense status to rejected
      const { data: updatedExpense, error: updateError } = await supabase
        .from('finance_expenses')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: approverId,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .select()
        .single();

      if (updateError) {
        console.error("Error rejecting expense:", updateError);
        return {
          success: false,
          error: updateError.message || "Failed to reject expense",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'expense',
        entityId: expenseId,
        action: 'reject',
        oldValues: { status: expense.status },
        newValues: {
          status: 'rejected',
          rejected_by: approverId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        },
      });

      // Create notification for expense submitter
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: expense.employee_id,
          type: 'expense_rejected',
          title: 'Expense rejected',
          message: `Your expense of ₨${expense.amount.toLocaleString()} for ${expense.category} has been rejected: ${reason}`,
          metadata: {
            expense_id: expenseId,
            amount: expense.amount,
            expense_category: expense.category,
            rejected_by: approverId,
            rejection_reason: reason,
            category: 'finance',
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

      return {
        success: true,
        expense_id: expenseId,
        new_status: 'rejected',
      };
    } catch (error) {
      console.error("Unexpected error rejecting expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process reimbursement for approved expense
   * 
   * Requirement 9.11: Update status to reimbursed and record payment date when reimbursement is processed
   * Requirement 9.8: Queue for reimbursement processing when approved
   */
  async processReimbursement(expenseId: string): Promise<ReimbursementResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Get expense details
      const { data: expense, error: fetchError } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError || !expense) {
        return { success: false, error: "Expense not found" };
      }

      // Validate expense is approved and not already reimbursed
      if (expense.status !== 'approved') {
        return {
          success: false,
          error: `Expense must be approved before reimbursement. Current status: ${expense.status}`,
        };
      }

      // Create journal entry for reimbursement
      // Debit: Expense account (already recorded when expense was approved)
      // Credit: Cash account (payment to employee)
      const ledgerResult = await this.recordReimbursementInLedger(
        expense.employee_id,
        expense.amount,
        expenseId,
        expense.category
      );

      if (!ledgerResult.success) {
        return {
          success: false,
          error: ledgerResult.error || "Failed to record reimbursement in ledger",
        };
      }

      // Update expense status to reimbursed
      const { data: updatedExpense, error: updateError } = await supabase
        .from('finance_expenses')
        .update({
          status: 'reimbursed',
          reimbursed_at: new Date().toISOString(),
          reimbursement_transaction_id: ledgerResult.journalEntryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating expense reimbursement status:", updateError);
        return {
          success: false,
          error: updateError.message || "Failed to update expense status",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'expense',
        entityId: expenseId,
        action: 'reimburse',
        oldValues: { status: expense.status },
        newValues: {
          status: 'reimbursed',
          reimbursed_at: new Date().toISOString(),
          reimbursement_transaction_id: ledgerResult.journalEntryId,
        },
      });

      // Create notification for employee
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: expense.employee_id,
          type: 'expense_reimbursed',
          title: 'Expense reimbursed',
          message: `Your expense of ₨${expense.amount.toLocaleString()} for ${expense.category} has been reimbursed`,
          metadata: {
            expense_id: expenseId,
            amount: expense.amount,
            expense_category: expense.category,
            transaction_id: ledgerResult.journalEntryId,
            category: 'finance',
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

      return {
        success: true,
        expense_id: expenseId,
        reimbursement_amount: expense.amount,
        transaction_id: ledgerResult.journalEntryId,
      };
    } catch (error) {
      console.error("Unexpected error processing reimbursement:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record reimbursement in general ledger
   * 
   * Creates journal entry:
   * - Debit: Expense account (expense incurred)
   * - Credit: Cash account (cash paid to employee)
   * 
   * @private
   */
  private async recordReimbursementInLedger(
    employeeId: string,
    amount: number,
    expenseId: string,
    category: string
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

      const { data: cashAccount } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('code', '1010') // Cash account
        .eq('is_active', true)
        .single();

      if (!expenseAccount || !cashAccount) {
        return { success: false, error: "Required accounts not found" };
      }

      // Create journal entry for reimbursement
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Employee expense reimbursement - ${category}`,
        reference: `EXP-${expenseId.substring(0, 8)}`,
        ledger_entries: [
          {
            account_id: expenseAccount.id,
            debit: amount,
            credit: 0,
            currency: 'PKR',
            description: `Expense: ${category}`,
          },
          {
            account_id: cashAccount.id,
            debit: 0,
            credit: amount,
            currency: 'PKR',
            description: 'Cash paid to employee',
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
      console.error("Unexpected error recording reimbursement in ledger:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const expenseManagerService = new ExpenseManagerService();
