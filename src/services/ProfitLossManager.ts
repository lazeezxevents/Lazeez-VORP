import { supabase } from "@/integrations/supabase/client";

export interface PLStatement {
  period_start: string;
  period_end: string;
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  gross_profit: number;
  operating_income: number;
  net_income: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
}

export interface RevenueBreakdown {
  total: number;
  subscription: number;
  commission: number;
  fees: number;
  other: number;
}

export interface ExpenseBreakdown {
  total: number;
  cogs: number;
  operating_expenses: OperatingExpenses;
  other_expenses: number;
}

export interface OperatingExpenses {
  total: number;
  salaries: number;
  rent: number;
  utilities: number;
  marketing: number;
  technology: number;
  other: number;
}

export interface PLComparison {
  current: PLStatement;
  previous: PLStatement;
  changes: {
    revenue_change: number;
    revenue_change_percent: number;
    expense_change: number;
    expense_change_percent: number;
    net_income_change: number;
    net_income_change_percent: number;
  };
}

export class ProfitLossManager {
  /**
   * Generate P&L statement for a period
   */
  static async generatePL(startDate: string, endDate: string): Promise<PLStatement> {
    // Input validation
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date values");
    }

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Validate date range is not too large (max 5 years)
    const maxRangeDays = 5 * 365;
    const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > maxRangeDays) {
      throw new Error("Date range cannot exceed 5 years");
    }

    // Aggregate revenue
    const revenue = await this.aggregateRevenue(startDate, endDate);

    // Aggregate expenses
    const expenses = await this.aggregateExpenses(startDate, endDate);

    // Calculate profits
    const gross_profit = revenue.total - expenses.cogs;
    const operating_income = gross_profit - expenses.operating_expenses.total;
    const net_income = operating_income - expenses.other_expenses;

    // Calculate margins
    const gross_margin = revenue.total > 0 ? (gross_profit / revenue.total) * 100 : 0;
    const operating_margin = revenue.total > 0 ? (operating_income / revenue.total) * 100 : 0;
    const net_margin = revenue.total > 0 ? (net_income / revenue.total) * 100 : 0;

    return {
      period_start: startDate,
      period_end: endDate,
      revenue,
      expenses,
      gross_profit,
      operating_income,
      net_income,
      gross_margin,
      operating_margin,
      net_margin,
    };
  }

  /**
   * Generate P&L by department
   */
  static async getDepartmentPL(
    departmentId: string,
    startDate: string,
    endDate: string
  ): Promise<PLStatement> {
    // Input validation
    if (!departmentId || departmentId.trim().length === 0) {
      throw new Error("Department ID is required");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(departmentId)) {
      throw new Error("Invalid department ID format");
    }

    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    // Similar to generatePL but filtered by department
    // This would require department tracking in transactions
    return this.generatePL(startDate, endDate);
  }

  /**
   * Generate P&L by vendor
   */
  static async getVendorPL(
    vendorId: string,
    startDate: string,
    endDate: string
  ): Promise<PLStatement> {
    // Input validation
    if (!vendorId || vendorId.trim().length === 0) {
      throw new Error("Vendor ID is required");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(vendorId)) {
      throw new Error("Invalid vendor ID format");
    }

    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    // Aggregate revenue from vendor orders
    const { data: orderData } = await supabase
      .from("finance_order_data")
      .select("order_amount, commission_amount")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const totalRevenue = orderData?.reduce((sum, order) => sum + order.order_amount, 0) || 0;
    const totalCommission = orderData?.reduce((sum, order) => sum + order.commission_amount, 0) || 0;

    const revenue: RevenueBreakdown = {
      total: totalRevenue,
      subscription: 0,
      commission: totalCommission,
      fees: 0,
      other: 0,
    };

    // For vendor P&L, expenses would be vendor-specific costs
    const expenses: ExpenseBreakdown = {
      total: 0,
      cogs: 0,
      operating_expenses: {
        total: 0,
        salaries: 0,
        rent: 0,
        utilities: 0,
        marketing: 0,
        technology: 0,
        other: 0,
      },
      other_expenses: 0,
    };

    const gross_profit = revenue.total - expenses.cogs;
    const operating_income = gross_profit - expenses.operating_expenses.total;
    const net_income = operating_income - expenses.other_expenses;

    return {
      period_start: startDate,
      period_end: endDate,
      revenue,
      expenses,
      gross_profit,
      operating_income,
      net_income,
      gross_margin: revenue.total > 0 ? (gross_profit / revenue.total) * 100 : 0,
      operating_margin: revenue.total > 0 ? (operating_income / revenue.total) * 100 : 0,
      net_margin: revenue.total > 0 ? (net_income / revenue.total) * 100 : 0,
    };
  }

  /**
   * Compare two periods
   */
  static async comparePeriods(
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string
  ): Promise<PLComparison> {
    const current = await this.generatePL(currentStart, currentEnd);
    const previous = await this.generatePL(previousStart, previousEnd);

    const revenue_change = current.revenue.total - previous.revenue.total;
    const revenue_change_percent =
      previous.revenue.total > 0 ? (revenue_change / previous.revenue.total) * 100 : 0;

    const expense_change = current.expenses.total - previous.expenses.total;
    const expense_change_percent =
      previous.expenses.total > 0 ? (expense_change / previous.expenses.total) * 100 : 0;

    const net_income_change = current.net_income - previous.net_income;
    const net_income_change_percent =
      previous.net_income !== 0 ? (net_income_change / Math.abs(previous.net_income)) * 100 : 0;

    return {
      current,
      previous,
      changes: {
        revenue_change,
        revenue_change_percent,
        expense_change,
        expense_change_percent,
        net_income_change,
        net_income_change_percent,
      },
    };
  }

  /**
   * Aggregate revenue from various sources
   */
  private static async aggregateRevenue(startDate: string, endDate: string): Promise<RevenueBreakdown> {
    // Get revenue from journal entries
    const { data: revenueEntries } = await supabase
      .from("finance_ledger_entries")
      .select("credit, finance_accounts!inner(code, name)")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .like("finance_accounts.code", "4%"); // Revenue accounts typically start with 4

    const total = revenueEntries?.reduce((sum, entry) => sum + entry.credit, 0) || 0;

    // Break down by source (simplified - would need better categorization)
    const subscription = 0; // Would query subscription-specific revenue
    const commission = 0; // Would query commission-specific revenue
    const fees = 0; // Would query fee-specific revenue
    const other = total - subscription - commission - fees;

    return {
      total,
      subscription,
      commission,
      fees,
      other,
    };
  }

  /**
   * Aggregate expenses by category
   */
  private static async aggregateExpenses(startDate: string, endDate: string): Promise<ExpenseBreakdown> {
    // Get expenses from journal entries
    const { data: expenseEntries } = await supabase
      .from("finance_ledger_entries")
      .select("debit, finance_accounts!inner(code, name, type)")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .or("finance_accounts.code.like.5%,finance_accounts.code.like.6%"); // Expense accounts

    const total = expenseEntries?.reduce((sum, entry) => sum + entry.debit, 0) || 0;

    // COGS (Cost of Goods Sold) - typically 5xxx accounts
    const cogs =
      expenseEntries
        ?.filter((entry: any) => entry.finance_accounts.code.startsWith("5"))
        .reduce((sum, entry) => sum + entry.debit, 0) || 0;

    // Operating expenses - typically 6xxx accounts
    const operatingTotal =
      expenseEntries
        ?.filter((entry: any) => entry.finance_accounts.code.startsWith("6"))
        .reduce((sum, entry) => sum + entry.debit, 0) || 0;

    // Break down operating expenses (simplified)
    const operating_expenses: OperatingExpenses = {
      total: operatingTotal,
      salaries: 0, // Would query salary-specific accounts
      rent: 0,
      utilities: 0,
      marketing: 0,
      technology: 0,
      other: operatingTotal,
    };

    const other_expenses = total - cogs - operatingTotal;

    return {
      total,
      cogs,
      operating_expenses,
      other_expenses,
    };
  }

  /**
   * Get cached P&L or generate new one
   */
  static async getCachedPL(startDate: string, endDate: string): Promise<PLStatement> {
    // Check cache (would use Redis or similar in production)
    const cacheKey = `pl_${startDate}_${endDate}`;
    
    // For now, just generate fresh
    // In production, implement caching with 5-minute TTL
    return this.generatePL(startDate, endDate);
  }
}
