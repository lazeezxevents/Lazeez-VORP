import { supabase } from "@/integrations/supabase/client";

export type BudgetPeriod = "annual" | "quarterly" | "monthly";
export type BudgetStatus = "draft" | "active" | "closed" | "revised";

export interface Budget {
  id: string;
  name: string;
  fiscal_year: number;
  period: BudgetPeriod;
  start_date: string;
  end_date: string;
  total_amount: number;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  utilization_percent: number;
  department_id?: string;
  status: BudgetStatus;
  alert_threshold_75: boolean;
  alert_threshold_90: boolean;
  alert_threshold_100: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetAllocation {
  id: string;
  budget_id: string;
  category: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  utilization_percent: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetRevision {
  id: string;
  budget_id: string;
  revision_number: number;
  previous_amount: number;
  new_amount: number;
  reason: string;
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
}

export interface CreateBudgetInput {
  name: string;
  fiscal_year: number;
  period: BudgetPeriod;
  start_date: string;
  end_date: string;
  total_amount: number;
  department_id?: string;
  notes?: string;
  allocations: Array<{
    category: string;
    allocated_amount: number;
    notes?: string;
  }>;
}

export class BudgetManager {
  /**
   * Create a new budget with allocations
   */
  static async createBudget(input: CreateBudgetInput, createdBy: string): Promise<Budget> {
    // Validate inputs
    if (!createdBy || createdBy.trim().length === 0) {
      throw new Error('Creator ID is required');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Budget name is required');
    }
    if (input.name.length > 200) {
      throw new Error('Budget name must be less than 200 characters');
    }
    if (input.fiscal_year < 2000 || input.fiscal_year > 2100) {
      throw new Error('Fiscal year must be between 2000 and 2100');
    }
    if (input.total_amount <= 0 || input.total_amount > 1000000000) {
      throw new Error('Total amount must be between 0 and 1,000,000,000');
    }
    if (new Date(input.start_date) >= new Date(input.end_date)) {
      throw new Error('Start date must be before end date');
    }

    // Validate total allocations match budget total
    const totalAllocated = input.allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
    if (Math.abs(totalAllocated - input.total_amount) > 0.01) {
      throw new Error(`Total allocations (${totalAllocated}) must equal budget total (${input.total_amount})`);
    }

    // Create budget
    const { data: budget, error: budgetError } = await supabase
      .from("finance_budgets")
      .insert({
        name: input.name,
        fiscal_year: input.fiscal_year,
        period: input.period,
        start_date: input.start_date,
        end_date: input.end_date,
        total_amount: input.total_amount,
        allocated_amount: totalAllocated,
        department_id: input.department_id,
        notes: input.notes,
        status: "draft",
        created_by: createdBy,
      })
      .select()
      .single();

    if (budgetError) {
      throw new Error(`Failed to create budget: ${budgetError.message}`);
    }

    // Create allocations
    const allocations = input.allocations.map((alloc) => ({
      budget_id: budget.id,
      category: alloc.category,
      allocated_amount: alloc.allocated_amount,
      notes: alloc.notes,
    }));

    const { error: allocError } = await supabase.from("finance_budget_allocations").insert(allocations);

    if (allocError) {
      // Rollback budget creation
      await supabase.from("finance_budgets").delete().eq("id", budget.id);
      throw new Error(`Failed to create budget allocations: ${allocError.message}`);
    }

    return budget as Budget;
  }

  /**
   * Allocate budget to categories
   */
  static async allocateBudget(
    budgetId: string,
    allocations: Array<{ category: string; allocated_amount: number; notes?: string }>
  ): Promise<void> {
    // Get budget
    const { data: budget } = await supabase
      .from("finance_budgets")
      .select("total_amount, allocated_amount")
      .eq("id", budgetId)
      .single();

    if (!budget) {
      throw new Error("Budget not found");
    }

    // Calculate new total allocated
    const newAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);

    if (newAllocated > budget.total_amount) {
      throw new Error(`Total allocations (${newAllocated}) exceed budget total (${budget.total_amount})`);
    }

    // Insert allocations
    const allocData = allocations.map((alloc) => ({
      budget_id: budgetId,
      ...alloc,
    }));

    const { error } = await supabase.from("finance_budget_allocations").insert(allocData);

    if (error) {
      throw new Error(`Failed to allocate budget: ${error.message}`);
    }

    // Update budget allocated amount
    await supabase
      .from("finance_budgets")
      .update({ allocated_amount: budget.allocated_amount + newAllocated })
      .eq("id", budgetId);
  }

  /**
   * Track spending against budget (automatically handled by trigger)
   */
  static async trackSpending(budgetId: string): Promise<{
    total_amount: number;
    spent_amount: number;
    remaining_amount: number;
    utilization_percent: number;
  }> {
    const { data: budget } = await supabase
      .from("finance_budgets")
      .select("total_amount, spent_amount, remaining_amount, utilization_percent")
      .eq("id", budgetId)
      .single();

    if (!budget) {
      throw new Error("Budget not found");
    }

    return budget;
  }

  /**
   * Forecast spending based on historical data
   */
  static async forecastSpending(budgetId: string): Promise<{
    projected_spent: number;
    projected_remaining: number;
    projected_utilization: number;
    will_exceed: boolean;
  }> {
    const { data: budget } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (!budget) {
      throw new Error("Budget not found");
    }

    // Calculate days elapsed and total days
    const startDate = new Date(budget.start_date);
    const endDate = new Date(budget.end_date);
    const today = new Date();

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = totalDays - elapsedDays;

    if (elapsedDays <= 0) {
      return {
        projected_spent: 0,
        projected_remaining: budget.total_amount,
        projected_utilization: 0,
        will_exceed: false,
      };
    }

    // Calculate daily burn rate
    const dailyBurnRate = budget.spent_amount / elapsedDays;

    // Project spending
    const projected_spent = budget.spent_amount + dailyBurnRate * remainingDays;
    const projected_remaining = budget.total_amount - projected_spent;
    const projected_utilization = (projected_spent / budget.total_amount) * 100;
    const will_exceed = projected_spent > budget.total_amount;

    return {
      projected_spent,
      projected_remaining,
      projected_utilization,
      will_exceed,
    };
  }

  /**
   * Check if expense can be submitted against budget
   */
  static async canSubmitExpense(
    departmentId: string,
    category: string,
    amount: number,
    expenseDate: string
  ): Promise<{ allowed: boolean; reason?: string; budget?: Budget }> {
    // Find active budget for department and date
    const { data: budgets } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("status", "active")
      .eq("department_id", departmentId)
      .lte("start_date", expenseDate)
      .gte("end_date", expenseDate);

    if (!budgets || budgets.length === 0) {
      return { allowed: true, reason: "No active budget found" };
    }

    const budget = budgets[0] as Budget;

    // Check if budget has enough remaining
    if (budget.remaining_amount < amount) {
      return {
        allowed: false,
        reason: `Insufficient budget. Remaining: PKR ${budget.remaining_amount.toLocaleString()}, Required: PKR ${amount.toLocaleString()}`,
        budget,
      };
    }

    // Check category allocation
    const { data: allocation } = await supabase
      .from("finance_budget_allocations")
      .select("*")
      .eq("budget_id", budget.id)
      .eq("category", category)
      .single();

    if (allocation && allocation.remaining_amount < amount) {
      return {
        allowed: false,
        reason: `Insufficient budget for category "${category}". Remaining: PKR ${allocation.remaining_amount.toLocaleString()}`,
        budget,
      };
    }

    return { allowed: true, budget };
  }

  /**
   * Revise budget with approval
   */
  static async reviseBudget(
    budgetId: string,
    newAmount: number,
    reason: string,
    approvedBy: string,
    createdBy: string
  ): Promise<Budget> {
    // Get current budget
    const { data: currentBudget } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (!currentBudget) {
      throw new Error("Budget not found");
    }

    // Get revision count
    const { data: revisions } = await supabase
      .from("finance_budget_revisions")
      .select("revision_number")
      .eq("budget_id", budgetId)
      .order("revision_number", { ascending: false })
      .limit(1);

    const revisionNumber = revisions && revisions.length > 0 ? revisions[0].revision_number + 1 : 1;

    // Create revision record
    await supabase.from("finance_budget_revisions").insert({
      budget_id: budgetId,
      revision_number: revisionNumber,
      previous_amount: currentBudget.total_amount,
      new_amount: newAmount,
      reason,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      created_by: createdBy,
    });

    // Update budget
    const { data: updatedBudget, error } = await supabase
      .from("finance_budgets")
      .update({
        total_amount: newAmount,
        status: "revised",
        updated_at: new Date().toISOString(),
      })
      .eq("id", budgetId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revise budget: ${error.message}`);
    }

    return updatedBudget as Budget;
  }

  /**
   * Get budget with allocations
   */
  static async getBudgetWithAllocations(budgetId: string): Promise<{
    budget: Budget;
    allocations: BudgetAllocation[];
  }> {
    const { data: budget, error: budgetError } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (budgetError || !budget) {
      throw new Error(`Failed to fetch budget: ${budgetError?.message || "Budget not found"}`);
    }

    const { data: allocations, error: allocError } = await supabase
      .from("finance_budget_allocations")
      .select("*")
      .eq("budget_id", budgetId);

    if (allocError) {
      throw new Error(`Failed to fetch allocations: ${allocError.message}`);
    }

    return {
      budget: budget as Budget,
      allocations: (allocations as BudgetAllocation[]) || [],
    };
  }

  /**
   * Get budgets by department
   */
  static async getBudgetsByDepartment(departmentId: string, fiscalYear?: number): Promise<Budget[]> {
    let query = supabase.from("finance_budgets").select("*").eq("department_id", departmentId);

    if (fiscalYear) {
      query = query.eq("fiscal_year", fiscalYear);
    }

    const { data, error } = await query.order("start_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch budgets: ${error.message}`);
    }

    return (data as Budget[]) || [];
  }

  /**
   * Activate budget
   */
  static async activateBudget(budgetId: string): Promise<Budget> {
    const { data, error } = await supabase
      .from("finance_budgets")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", budgetId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to activate budget: ${error.message}`);
    }

    return data as Budget;
  }

  /**
   * Close budget
   */
  static async closeBudget(budgetId: string): Promise<Budget> {
    const { data, error } = await supabase
      .from("finance_budgets")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", budgetId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to close budget: ${error.message}`);
    }

    return data as Budget;
  }
}
