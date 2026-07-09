import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ExpenseStatus = "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "reimbursed";

export interface Expense {
  id: string;
  employee_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  receipt_url?: string;
  status: ExpenseStatus;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  reimbursed_at?: string;
  policy_violations?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all expenses for the current user
 */
export function useExpenses(employeeId?: string, status?: ExpenseStatus) {
  return useQuery({
    queryKey: ["expenses", employeeId, status],
    queryFn: async () => {
      let query = supabase.from("finance_expenses").select("*").order("expense_date", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Expense[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch a single expense
 */
export function useExpense(expenseId: string) {
  return useQuery({
    queryKey: ["expenses", expenseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_expenses").select("*").eq("id", expenseId).single();

      if (error) throw error;
      return data as Expense;
    },
    enabled: !!expenseId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Submit a new expense
 */
export function useSubmitExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      category,
      amount,
      expenseDate,
      description,
      receiptUrl,
    }: {
      employeeId: string;
      category: string;
      amount: number;
      expenseDate: string;
      description?: string;
      receiptUrl?: string;
    }) => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .insert({
          employee_id: employeeId,
          category,
          amount,
          expense_date: expenseDate,
          description,
          receipt_url: receiptUrl,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit expense: ${error.message}`);
    },
  });
}

/**
 * Approve an expense
 */
export function useApproveExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ expenseId, approverId }: { expenseId: string; approverId: string }) => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .update({
          status: "approved",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", expenseId)
        .select()
        .single();

      if (error) throw error;
      return data as Expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", data.id] });
      toast.success("Expense approved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve expense: ${error.message}`);
    },
  });
}

/**
 * Reject an expense
 */
export function useRejectExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      rejectorId,
      reason,
    }: {
      expenseId: string;
      rejectorId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .update({
          status: "rejected",
          rejected_by: rejectorId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", expenseId)
        .select()
        .single();

      if (error) throw error;
      return data as Expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", data.id] });
      toast.success("Expense rejected");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject expense: ${error.message}`);
    },
  });
}

/**
 * Mark expense as reimbursed
 */
export function useReimburseExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .update({
          status: "reimbursed",
          reimbursed_at: new Date().toISOString(),
        })
        .eq("id", expenseId)
        .select()
        .single();

      if (error) throw error;
      return data as Expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", data.id] });
      toast.success("Expense marked as reimbursed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark expense as reimbursed: ${error.message}`);
    },
  });
}

/**
 * Fetch pending expenses for approval
 */
export function usePendingExpenses(approverId?: string) {
  return useQuery({
    queryKey: ["expenses", "pending", approverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .select("*")
        .in("status", ["submitted", "pending_approval"])
        .order("submitted_at", { ascending: true });

      if (error) throw error;
      return data as Expense[];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Fetch expense summary by category
 */
export function useExpenseSummary(employeeId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["expense-summary", employeeId, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from("finance_expenses").select("category, amount, status");

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      if (startDate) {
        query = query.gte("expense_date", startDate);
      }

      if (endDate) {
        query = query.lte("expense_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate by category
      const summary = data.reduce((acc: Record<string, { total: number; count: number }>, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = { total: 0, count: 0 };
        }
        acc[expense.category].total += expense.amount;
        acc[expense.category].count += 1;
        return acc;
      }, {});

      return summary;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
