import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BudgetManager, Budget, CreateBudgetInput } from "@/services/BudgetManager";
import { toast } from "sonner";

/**
 * Fetch all budgets for a department
 */
export function useBudgets(departmentId?: string, fiscalYear?: number) {
  return useQuery({
    queryKey: ["budgets", departmentId, fiscalYear],
    queryFn: async () => {
      if (departmentId) {
        return await BudgetManager.getBudgetsByDepartment(departmentId, fiscalYear);
      }
      
      // Fetch all budgets
      const { data, error } = await supabase
        .from("finance_budgets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Budget[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single budget with allocations
 */
export function useBudget(budgetId: string) {
  return useQuery({
    queryKey: ["budgets", budgetId],
    queryFn: async () => {
      return await BudgetManager.getBudgetWithAllocations(budgetId);
    },
    enabled: !!budgetId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new budget
 */
export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, createdBy }: { input: CreateBudgetInput; createdBy: string }) => {
      return await BudgetManager.createBudget(input, createdBy);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create budget: ${error.message}`);
    },
  });
}

/**
 * Activate a budget
 */
export function useActivateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budgetId: string) => {
      return await BudgetManager.activateBudget(budgetId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets", data.id] });
      toast.success("Budget activated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to activate budget: ${error.message}`);
    },
  });
}

/**
 * Close a budget
 */
export function useCloseBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budgetId: string) => {
      return await BudgetManager.closeBudget(budgetId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets", data.id] });
      toast.success("Budget closed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to close budget: ${error.message}`);
    },
  });
}

/**
 * Revise a budget
 */
export function useReviseBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budgetId,
      newAmount,
      reason,
      approvedBy,
      createdBy,
    }: {
      budgetId: string;
      newAmount: number;
      reason: string;
      approvedBy: string;
      createdBy: string;
    }) => {
      return await BudgetManager.reviseBudget(budgetId, newAmount, reason, approvedBy, createdBy);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets", data.id] });
      toast.success("Budget revised successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revise budget: ${error.message}`);
    },
  });
}

/**
 * Get budget spending forecast
 */
export function useBudgetForecast(budgetId: string) {
  return useQuery({
    queryKey: ["budget-forecast", budgetId],
    queryFn: async () => {
      return await BudgetManager.forecastSpending(budgetId);
    },
    enabled: !!budgetId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Check if expense can be submitted
 */
export function useCanSubmitExpense() {
  return useMutation({
    mutationFn: async ({
      departmentId,
      category,
      amount,
      expenseDate,
    }: {
      departmentId: string;
      category: string;
      amount: number;
      expenseDate: string;
    }) => {
      return await BudgetManager.canSubmitExpense(departmentId, category, amount, expenseDate);
    },
  });
}
