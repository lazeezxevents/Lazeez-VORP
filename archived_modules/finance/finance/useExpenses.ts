import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { expenseManagerService, type ExpenseSubmission, type Expense } from "./ExpenseManagerService";
import { expensePolicyValidator } from "./ExpensePolicyValidator";
import { expenseApprovalWorkflow } from "./ExpenseApprovalWorkflow";
import { toast } from "sonner";

/**
 * TanStack Query hook for expense management
 * 
 * Provides queries and mutations for:
 * - Fetching expenses (all, by employee, by status)
 * - Submitting expenses with validation
 * - Approving/rejecting expenses
 * - Processing reimbursements
 * 
 * Task: 18.5, 18.6 - Support expense submission and approval interfaces
 */

// =====================================================
// Query Keys
// =====================================================

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (filters: string) => [...expenseKeys.lists(), filters] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
  myExpenses: (userId: string) => [...expenseKeys.all, 'my', userId] as const,
  pendingApprovals: (userId: string) => [...expenseKeys.all, 'pending', userId] as const,
};

// =====================================================
// Queries
// =====================================================

/**
 * Fetch all expenses (admin/finance view)
 */
export function useExpenses() {
  return useQuery({
    queryKey: expenseKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_expenses')
        .select(`
          *,
          employee:profiles!finance_expenses_employee_id_fkey(id, full_name, email),
          approver:profiles!finance_expenses_approved_by_fkey(id, full_name)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
  });
}

/**
 * Fetch expenses for current user
 */
export function useMyExpenses() {
  return useQuery({
    queryKey: expenseKeys.myExpenses('current'),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('finance_expenses')
        .select(`
          *,
          approver:profiles!finance_expenses_approved_by_fkey(id, full_name)
        `)
        .eq('employee_id', user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
  });
}

/**
 * Fetch expenses pending approval for current user
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: expenseKeys.pendingApprovals('current'),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get expenses where user is in the approval chain or is a manager/admin
      const { data, error } = await supabase
        .from('finance_expenses')
        .select(`
          *,
          employee:profiles!finance_expenses_employee_id_fkey(id, full_name, email, department_id)
        `)
        .in('status', ['submitted', 'pending_approval'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Filter expenses that need this user's approval
      // This is a simplified version - in production, you'd check approval chains
      return data as Expense[];
    },
  });
}

/**
 * Fetch single expense by ID
 */
export function useExpense(expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_expenses')
        .select(`
          *,
          employee:profiles!finance_expenses_employee_id_fkey(id, full_name, email),
          approver:profiles!finance_expenses_approved_by_fkey(id, full_name)
        `)
        .eq('id', expenseId)
        .single();

      if (error) throw error;
      return data as Expense;
    },
    enabled: !!expenseId,
  });
}

// =====================================================
// Mutations
// =====================================================

/**
 * Submit expense mutation
 */
export function useSubmitExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: ExpenseSubmission) => {
      // Validate against policies
      const validation = await expensePolicyValidator.validateExpense(expense);

      // Show warnings to user
      if (validation.violations.length > 0) {
        validation.violations.forEach(violation => {
          if (violation.severity === 'warning') {
            toast.warning(violation.message);
          } else {
            toast.error(violation.message);
          }
        });
      }

      // If there are errors, don't submit
      if (!validation.isValid) {
        throw new Error('Expense validation failed');
      }

      // Submit expense
      const result = await expenseManagerService.submitExpense(expense);

      if (!result.success || !result.expense) {
        throw new Error(result.error || 'Failed to submit expense');
      }

      // Route through approval workflow
      await expenseApprovalWorkflow.routeExpense(
        result.expense.id,
        expense.employeeId,
        expense.amount,
        expense.category,
        validation.requiresSpecialApproval
      );

      return result.expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      toast.success('Expense submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit expense');
    },
  });
}

/**
 * Approve expense mutation
 */
export function useApproveExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      approverId,
      notes,
    }: {
      expenseId: string;
      approverId: string;
      notes?: string;
    }) => {
      const result = await expenseManagerService.approveExpense(
        expenseId,
        approverId,
        notes
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to approve expense');
      }

      // Track approval history
      await expenseApprovalWorkflow.trackApprovalHistory(
        expenseId,
        approverId,
        'approved',
        notes
      );

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      toast.success('Expense approved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve expense');
    },
  });
}

/**
 * Reject expense mutation
 */
export function useRejectExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      approverId,
      reason,
    }: {
      expenseId: string;
      approverId: string;
      reason: string;
    }) => {
      const result = await expenseManagerService.rejectExpense(
        expenseId,
        approverId,
        reason
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to reject expense');
      }

      // Track approval history
      await expenseApprovalWorkflow.trackApprovalHistory(
        expenseId,
        approverId,
        'rejected',
        reason
      );

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      toast.success('Expense rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject expense');
    },
  });
}

/**
 * Process reimbursement mutation
 */
export function useProcessReimbursement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const result = await expenseManagerService.processReimbursement(expenseId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to process reimbursement');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      toast.success('Reimbursement processed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process reimbursement');
    },
  });
}
