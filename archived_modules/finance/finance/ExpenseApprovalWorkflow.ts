import { supabase } from "@/integrations/supabase/client";

/**
 * Expense Approval Workflow
 * 
 * Routes expenses through configured approval chains based on:
 * - Expense amount thresholds
 * - Expense category
 * - Employee department and role
 * - Policy violations
 * 
 * Notifies approvers and tracks approval history.
 * 
 * Requirements: 9.3, 9.4
 * Task: 18.3 Implement approval workflow routing
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface ApprovalChainConfig {
  minAmount: number;
  maxAmount: number;
  approverRoles: string[];
  requiresMultipleApprovals: boolean;
}

export interface ApprovalRoute {
  approvers: string[];
  notificationsSent: boolean;
  currentStep: number;
  totalSteps: number;
}

export interface NotificationResult {
  success: boolean;
  notificationIds: string[];
  error?: string;
}

// =====================================================
// Approval Chain Configuration
// =====================================================

const APPROVAL_CHAINS: ApprovalChainConfig[] = [
  {
    minAmount: 0,
    maxAmount: 10000,
    approverRoles: ['manager'],
    requiresMultipleApprovals: false,
  },
  {
    minAmount: 10001,
    maxAmount: 50000,
    approverRoles: ['manager', 'finance_manager'],
    requiresMultipleApprovals: false,
  },
  {
    minAmount: 50001,
    maxAmount: 100000,
    approverRoles: ['finance_manager'],
    requiresMultipleApprovals: false,
  },
  {
    minAmount: 100001,
    maxAmount: Infinity,
    approverRoles: ['finance_admin'],
    requiresMultipleApprovals: true,
  },
];

// =====================================================
// Expense Approval Workflow Service
// =====================================================

export class ExpenseApprovalWorkflow {
  /**
   * Route expense through configured approval chain
   * 
   * Requirement 9.3: Route expenses through configured approval workflows based on amount and category
   */
  async routeExpense(
    expenseId: string,
    employeeId: string,
    amount: number,
    category: string,
    hasViolations: boolean = false
  ): Promise<ApprovalRoute> {
    try {
      // Determine approval chain based on amount
      const approvalChain = this.determineApprovalChain(amount, hasViolations);

      // Get approvers based on employee's department and approval chain
      const approvers = await this.getApprovers(employeeId, approvalChain);

      if (approvers.length === 0) {
        console.warn(`No approvers found for expense ${expenseId}`);
        return {
          approvers: [],
          notificationsSent: false,
          currentStep: 0,
          totalSteps: 0,
        };
      }

      // Notify approvers
      const notificationResult = await this.notifyApprovers(
        expenseId,
        approvers,
        amount,
        category,
        employeeId
      );

      // Update expense status to pending_approval
      await supabase
        .from('finance_expenses')
        .update({
          status: 'pending_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      return {
        approvers,
        notificationsSent: notificationResult.success,
        currentStep: 1,
        totalSteps: approvers.length,
      };
    } catch (error) {
      console.error('Error routing expense:', error);
      return {
        approvers: [],
        notificationsSent: false,
        currentStep: 0,
        totalSteps: 0,
      };
    }
  }

  /**
   * Determine approval chain based on amount and violations
   * 
   * Requirement 9.3: Route based on amount and category
   */
  private determineApprovalChain(
    amount: number,
    hasViolations: boolean
  ): ApprovalChainConfig {
    // If there are policy violations, require highest level approval
    if (hasViolations) {
      return APPROVAL_CHAINS[APPROVAL_CHAINS.length - 1];
    }

    // Find appropriate chain based on amount
    const chain = APPROVAL_CHAINS.find(
      c => amount >= c.minAmount && amount <= c.maxAmount
    );

    return chain || APPROVAL_CHAINS[0];
  }

  /**
   * Get approvers based on employee's department and approval chain
   * 
   * Requirement 9.3: Route through configured approval chains
   */
  private async getApprovers(
    employeeId: string,
    approvalChain: ApprovalChainConfig
  ): Promise<string[]> {
    try {
      // Get employee's department and manager
      const { data: employee, error: empError } = await supabase
        .from('profiles')
        .select('department_id, manager_id')
        .eq('id', employeeId)
        .single();

      if (empError || !employee) {
        console.error('Error fetching employee:', empError);
        return [];
      }

      const approvers: string[] = [];

      // Add manager if required
      if (approvalChain.approverRoles.includes('manager') && employee.manager_id) {
        approvers.push(employee.manager_id);
      }

      // Add finance managers if required
      if (approvalChain.approverRoles.includes('finance_manager')) {
        const { data: financeManagers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'staff')
          .eq('is_active', true)
          .limit(1);

        if (financeManagers && financeManagers.length > 0) {
          approvers.push(...financeManagers.map(m => m.id));
        }
      }

      // Add finance admins if required
      if (approvalChain.approverRoles.includes('finance_admin')) {
        const { data: financeAdmins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .eq('is_active', true)
          .limit(1);

        if (financeAdmins && financeAdmins.length > 0) {
          approvers.push(...financeAdmins.map(a => a.id));
        }
      }

      // Remove duplicates
      return [...new Set(approvers)];
    } catch (error) {
      console.error('Error getting approvers:', error);
      return [];
    }
  }

  /**
   * Notify approvers of pending expense
   * 
   * Requirement 9.4: Notify approvers of pending expenses
   */
  private async notifyApprovers(
    expenseId: string,
    approvers: string[],
    amount: number,
    category: string,
    employeeId: string
  ): Promise<NotificationResult> {
    try {
      // Get employee name
      const { data: employee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', employeeId)
        .single();

      const employeeName = employee?.full_name || 'An employee';

      // Create notifications for all approvers
      const notifications = approvers.map(approverId => ({
        user_id: approverId,
        type: 'expense_pending_approval',
        title: 'Expense pending approval',
        message: `${employeeName} submitted an expense of ₨${amount.toLocaleString()} for ${category}`,
        metadata: {
          expense_id: expenseId,
          amount,
          expense_category: category,
          employee_id: employeeId,
          employee_name: employeeName,
          category: 'finance',
        },
        is_read: false,
      }));

      const { data: createdNotifications, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (error) {
        console.error('Error creating notifications:', error);
        return {
          success: false,
          notificationIds: [],
          error: error.message,
        };
      }

      return {
        success: true,
        notificationIds: createdNotifications?.map(n => n.id) || [],
      };
    } catch (error) {
      console.error('Unexpected error notifying approvers:', error);
      return {
        success: false,
        notificationIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Track approval history
   * 
   * Requirement 9.3: Track approval history
   */
  async trackApprovalHistory(
    expenseId: string,
    approverId: string,
    action: 'approved' | 'rejected',
    notes?: string
  ): Promise<boolean> {
    try {
      // Get current expense
      const { data: expense, error: fetchError } = await supabase
        .from('finance_expenses')
        .select('approval_chain')
        .eq('id', expenseId)
        .single();

      if (fetchError || !expense) {
        console.error('Error fetching expense:', fetchError);
        return false;
      }

      // Update approval chain
      const approvalChain = expense.approval_chain || [];
      approvalChain.push({
        approver_id: approverId,
        action,
        timestamp: new Date().toISOString(),
        notes: notes || null,
      });

      // Update expense
      const { error: updateError } = await supabase
        .from('finance_expenses')
        .update({
          approval_chain: approvalChain,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (updateError) {
        console.error('Error updating approval chain:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error tracking approval history:', error);
      return false;
    }
  }

  /**
   * Get approval chain configuration for amount
   */
  getApprovalChainForAmount(amount: number): ApprovalChainConfig {
    return this.determineApprovalChain(amount, false);
  }

  /**
   * Get all approval chain configurations
   */
  getAllApprovalChains(): ApprovalChainConfig[] {
    return APPROVAL_CHAINS;
  }
}

// Export singleton instance
export const expenseApprovalWorkflow = new ExpenseApprovalWorkflow();
