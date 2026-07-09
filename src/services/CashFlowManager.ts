import { supabase } from "@/integrations/supabase/client";

export type CashFlowActivity = "operating" | "investing" | "financing";
export type CashFlowType = "inflow" | "outflow";

export interface CashFlowEntry {
  id: string;
  date: string;
  activity: CashFlowActivity;
  type: CashFlowType;
  amount: number;
  description: string;
  category: string;
  source_module?: string;
  source_id?: string;
  created_at: string;
}

export interface CashFlowStatement {
  period_start: string;
  period_end: string;
  beginning_cash: number;
  operating_activities: CashFlowCategory;
  investing_activities: CashFlowCategory;
  financing_activities: CashFlowCategory;
  net_cash_change: number;
  ending_cash: number;
}

export interface CashFlowCategory {
  inflows: number;
  outflows: number;
  net: number;
  items: Array<{
    description: string;
    amount: number;
    type: CashFlowType;
  }>;
}

export interface CashPosition {
  current_cash: number;
  projected_cash: number;
  projection_date: string;
  runway_days?: number;
  alert_level: "safe" | "warning" | "critical";
}

export class CashFlowManager {
  private static readonly CASH_THRESHOLD_WARNING = 100000; // PKR
  private static readonly CASH_THRESHOLD_CRITICAL = 50000; // PKR

  /**
   * Record a cash flow entry
   */
  static async recordCashFlow(entry: {
    date: string;
    activity: CashFlowActivity;
    type: CashFlowType;
    amount: number;
    description: string;
    category: string;
    source_module?: string;
    source_id?: string;
  }): Promise<CashFlowEntry> {
    // Input validation
    if (!entry.date) {
      throw new Error("Date is required");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(entry.date)) {
      throw new Error("Date must be in YYYY-MM-DD format");
    }

    const date = new Date(entry.date);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date value");
    }

    if (!entry.activity || !["operating", "investing", "financing"].includes(entry.activity)) {
      throw new Error("Valid activity is required (operating, investing, or financing)");
    }

    if (!entry.type || !["inflow", "outflow"].includes(entry.type)) {
      throw new Error("Valid type is required (inflow or outflow)");
    }

    if (typeof entry.amount !== "number" || entry.amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    if (entry.amount > 1000000000) {
      throw new Error("Amount cannot exceed 1 billion PKR");
    }

    if (!entry.description || entry.description.trim().length === 0) {
      throw new Error("Description is required");
    }

    if (entry.description.length > 500) {
      throw new Error("Description cannot exceed 500 characters");
    }

    if (!entry.category || entry.category.trim().length === 0) {
      throw new Error("Category is required");
    }

    if (entry.category.length > 100) {
      throw new Error("Category cannot exceed 100 characters");
    }

    const { data, error } = await supabase
      .from("finance_cash_flow")
      .insert({
        ...entry,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record cash flow: ${error.message}`);
    }

    return data as CashFlowEntry;
  }

  /**
   * Generate cash flow statement for a period
   */
  static async getCashFlowStatement(startDate: string, endDate: string): Promise<CashFlowStatement> {
    // Input validation
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date values");
    }

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Get all cash flow entries for the period
    const { data: entries, error } = await supabase
      .from("finance_cash_flow")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch cash flow entries: ${error.message}`);
    }

    // Get beginning cash balance
    const beginning_cash = await this.getCashBalance(startDate);

    // Categorize entries
    const operating = this.categorizeEntries(entries || [], "operating");
    const investing = this.categorizeEntries(entries || [], "investing");
    const financing = this.categorizeEntries(entries || [], "financing");

    // Calculate net cash change
    const net_cash_change = operating.net + investing.net + financing.net;
    const ending_cash = beginning_cash + net_cash_change;

    return {
      period_start: startDate,
      period_end: endDate,
      beginning_cash,
      operating_activities: operating,
      investing_activities: investing,
      financing_activities: financing,
      net_cash_change,
      ending_cash,
    };
  }

  /**
   * Forecast cash flow for future periods
   */
  static async forecastCashFlow(months: number = 3): Promise<Array<{ month: string; projected_cash: number }>> {
    // Get historical cash flow data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: historicalEntries } = await supabase
      .from("finance_cash_flow")
      .select("*")
      .gte("date", sixMonthsAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // Calculate average monthly cash flow
    const monthlyAverages = this.calculateMonthlyAverages(historicalEntries || []);

    // Project future cash flow
    const currentCash = await this.getCurrentCashPosition();
    const forecast: Array<{ month: string; projected_cash: number }> = [];

    let projectedCash = currentCash.current_cash;

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      const monthKey = futureDate.toISOString().slice(0, 7); // YYYY-MM

      // Apply average monthly change
      projectedCash += monthlyAverages.net_change;

      forecast.push({
        month: monthKey,
        projected_cash: projectedCash,
      });
    }

    return forecast;
  }

  /**
   * Get current cash position with alerts
   */
  static async getCashPosition(): Promise<CashPosition> {
    const current_cash = await this.getCurrentCashBalance();

    // Forecast next month
    const forecast = await this.forecastCashFlow(1);
    const projected_cash = forecast[0]?.projected_cash || current_cash;

    // Calculate runway (days until cash runs out)
    const dailyBurnRate = await this.calculateDailyBurnRate();
    const runway_days = dailyBurnRate > 0 ? Math.floor(current_cash / dailyBurnRate) : undefined;

    // Determine alert level
    let alert_level: "safe" | "warning" | "critical" = "safe";
    if (current_cash < this.CASH_THRESHOLD_CRITICAL || (runway_days && runway_days < 30)) {
      alert_level = "critical";
    } else if (current_cash < this.CASH_THRESHOLD_WARNING || (runway_days && runway_days < 60)) {
      alert_level = "warning";
    }

    return {
      current_cash,
      projected_cash,
      projection_date: forecast[0]?.month || new Date().toISOString().slice(0, 7),
      runway_days,
      alert_level,
    };
  }

  /**
   * Get cash balance at a specific date
   */
  private static async getCashBalance(date: string): Promise<number> {
    // Query cash account balance from general ledger
    const { data: cashAccount } = await supabase
      .from("finance_accounts")
      .select("id, balance")
      .eq("code", "1000") // Cash account
      .single();

    if (!cashAccount) {
      return 0;
    }

    // Get balance at specific date
    const { data: entries } = await supabase
      .from("finance_ledger_entries")
      .select("debit, credit")
      .eq("account_id", cashAccount.id)
      .lte("created_at", date);

    const balance = entries?.reduce((sum, entry) => sum + entry.debit - entry.credit, 0) || 0;

    return balance;
  }

  /**
   * Get current cash balance
   */
  private static async getCurrentCashBalance(): Promise<number> {
    const { data: cashAccount } = await supabase
      .from("finance_accounts")
      .select("balance")
      .eq("code", "1000") // Cash account
      .single();

    return cashAccount?.balance || 0;
  }

  /**
   * Categorize cash flow entries by activity
   */
  private static categorizeEntries(entries: any[], activity: CashFlowActivity): CashFlowCategory {
    const filtered = entries.filter((e) => e.activity === activity);

    const inflows = filtered
      .filter((e) => e.type === "inflow")
      .reduce((sum, e) => sum + e.amount, 0);

    const outflows = filtered
      .filter((e) => e.type === "outflow")
      .reduce((sum, e) => sum + e.amount, 0);

    const items = filtered.map((e) => ({
      description: e.description,
      amount: e.amount,
      type: e.type,
    }));

    return {
      inflows,
      outflows,
      net: inflows - outflows,
      items,
    };
  }

  /**
   * Calculate monthly averages from historical data
   */
  private static calculateMonthlyAverages(entries: any[]): {
    avg_inflow: number;
    avg_outflow: number;
    net_change: number;
  } {
    // Group by month
    const monthlyData: Record<string, { inflow: number; outflow: number }> = {};

    entries.forEach((entry) => {
      const month = entry.date.slice(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { inflow: 0, outflow: 0 };
      }

      if (entry.type === "inflow") {
        monthlyData[month].inflow += entry.amount;
      } else {
        monthlyData[month].outflow += entry.amount;
      }
    });

    const months = Object.keys(monthlyData);
    if (months.length === 0) {
      return { avg_inflow: 0, avg_outflow: 0, net_change: 0 };
    }

    const totalInflow = months.reduce((sum, month) => sum + monthlyData[month].inflow, 0);
    const totalOutflow = months.reduce((sum, month) => sum + monthlyData[month].outflow, 0);

    const avg_inflow = totalInflow / months.length;
    const avg_outflow = totalOutflow / months.length;
    const net_change = avg_inflow - avg_outflow;

    return { avg_inflow, avg_outflow, net_change };
  }

  /**
   * Calculate daily burn rate (average daily cash outflow)
   */
  private static async calculateDailyBurnRate(): Promise<number> {
    // Get last 30 days of outflows
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: outflows } = await supabase
      .from("finance_cash_flow")
      .select("amount")
      .eq("type", "outflow")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const totalOutflow = outflows?.reduce((sum, entry) => sum + entry.amount, 0) || 0;

    return totalOutflow / 30;
  }

  /**
   * Check if cash position is below threshold and send alerts
   */
  static async checkCashPositionAlerts(): Promise<{
    should_alert: boolean;
    alert_level: "warning" | "critical" | null;
    message: string;
  }> {
    const position = await this.getCashPosition();

    if (position.alert_level === "critical") {
      return {
        should_alert: true,
        alert_level: "critical",
        message: `Critical: Cash position is PKR ${position.current_cash.toLocaleString()}. ${
          position.runway_days ? `Only ${position.runway_days} days of runway remaining.` : ""
        }`,
      };
    }

    if (position.alert_level === "warning") {
      return {
        should_alert: true,
        alert_level: "warning",
        message: `Warning: Cash position is PKR ${position.current_cash.toLocaleString()}. ${
          position.runway_days ? `${position.runway_days} days of runway remaining.` : ""
        }`,
      };
    }

    return {
      should_alert: false,
      alert_level: null,
      message: "Cash position is healthy",
    };
  }
}
