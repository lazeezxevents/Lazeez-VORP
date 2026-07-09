import { ForecastingEngine } from "./ForecastingEngine";
import { AnomalyDetector } from "./AnomalyDetector";
import { OptimizationEngine } from "./OptimizationEngine";
import { supabase } from "@/integrations/supabase/client";

export interface AIQueryResponse {
  content: string;
  type: "text" | "chart" | "recommendation";
  metadata?: any;
}

export class AIFinanceQueryProcessor {
  /**
   * Process natural language financial query
   */
  static async processQuery(query: string): Promise<AIQueryResponse> {
    // Validate input
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    if (query.length > 500) {
      throw new Error("Query too long (max 500 characters)");
    }

    const lowerQuery = query.toLowerCase();

    try {
      // Revenue forecast queries
      if (this.isRevenueForecastQuery(lowerQuery)) {
        return await this.handleRevenueForecast(lowerQuery);
      }

      // Cash flow queries
      if (this.isCashFlowQuery(lowerQuery)) {
        return await this.handleCashFlow(lowerQuery);
      }

      // Commission optimization queries
      if (this.isCommissionQuery(lowerQuery)) {
        return await this.handleCommissionOptimization(lowerQuery);
      }

      // Anomaly detection queries
      if (this.isAnomalyQuery(lowerQuery)) {
        return await this.handleAnomalyDetection(lowerQuery);
      }

      // P&L queries
      if (this.isProfitLossQuery(lowerQuery)) {
        return await this.handleProfitLoss(lowerQuery);
      }

      // Budget queries
      if (this.isBudgetQuery(lowerQuery)) {
        return await this.handleBudget(lowerQuery);
      }

      // Default response
      return this.getDefaultResponse();
    } catch (error) {
      console.error("Error processing query:", error);
      return {
        content: `I encountered an error processing your request: ${error instanceof Error ? error.message : "Unknown error"}. Please try rephrasing your question or contact support if the issue persists.`,
        type: "text",
      };
    }
  }

  /**
   * Check if query is about revenue forecasting
   */
  private static isRevenueForecastQuery(query: string): boolean {
    return (
      query.includes("revenue") &&
      (query.includes("forecast") || query.includes("predict") || query.includes("projection"))
    );
  }

  /**
   * Check if query is about cash flow
   */
  private static isCashFlowQuery(query: string): boolean {
    return query.includes("cash") && (query.includes("flow") || query.includes("position"));
  }

  /**
   * Check if query is about commission optimization
   */
  private static isCommissionQuery(query: string): boolean {
    return query.includes("commission") && (query.includes("optim") || query.includes("analyz") || query.includes("rate"));
  }

  /**
   * Check if query is about anomaly detection
   */
  private static isAnomalyQuery(query: string): boolean {
    return (
      query.includes("anomal") ||
      query.includes("unusual") ||
      query.includes("suspicious") ||
      query.includes("fraud") ||
      query.includes("outlier")
    );
  }

  /**
   * Check if query is about P&L
   */
  private static isProfitLossQuery(query: string): boolean {
    return query.includes("profit") || query.includes("p&l") || query.includes("income") || query.includes("loss");
  }

  /**
   * Check if query is about budget
   */
  private static isBudgetQuery(query: string): boolean {
    return query.includes("budget");
  }

  /**
   * Handle revenue forecast queries
   */
  private static async handleRevenueForecast(query: string): Promise<AIQueryResponse> {
    // Extract time period from query (default to 6 months)
    const months = this.extractMonths(query) || 6;

    // Generate forecast
    const forecastId = await ForecastingEngine.forecastRevenue(months, "seasonal");

    // Get forecast details
    const { data: forecast, error } = await supabase
      .from("finance_forecasts")
      .select("*")
      .eq("id", forecastId)
      .single();

    if (error || !forecast) {
      throw new Error("Failed to generate revenue forecast");
    }

    // Format response
    const predictions = forecast.predictions as Record<string, number>;
    const firstMonth = Object.keys(predictions)[0];
    const lastMonth = Object.keys(predictions)[predictions.length - 1];
    const avgPrediction =
      Object.values(predictions).reduce((sum, val) => sum + val, 0) / Object.values(predictions).length;

    const trendEmoji = forecast.trend_direction === "increasing" ? "📈" : forecast.trend_direction === "decreasing" ? "📉" : "➡️";
    const growthPercent = (forecast.growth_rate * 100).toFixed(1);

    let content = `Revenue forecast for next ${months} months:\n\n`;
    content += `${trendEmoji} Trend: ${forecast.trend_direction} (${growthPercent}% growth rate)\n`;
    content += `💰 Average predicted revenue: PKR ${avgPrediction.toFixed(0)}\n`;
    content += `📊 Confidence: ${forecast.seasonality_detected ? "High (seasonal patterns detected)" : "Medium"}\n\n`;

    if (forecast.recommendations && forecast.recommendations.length > 0) {
      content += "Recommendations:\n";
      forecast.recommendations.forEach((rec: string, i: number) => {
        content += `${i + 1}. ${rec}\n`;
      });
    }

    return {
      content,
      type: "recommendation",
      metadata: {
        forecastId,
        months,
        trend: forecast.trend_direction,
        growthRate: forecast.growth_rate,
      },
    };
  }

  /**
   * Handle cash flow queries
   */
  private static async handleCashFlow(query: string): Promise<AIQueryResponse> {
    // Extract time period from query (default to 6 months)
    const months = this.extractMonths(query) || 6;

    // Generate cash flow forecast
    const forecastId = await ForecastingEngine.predictCashFlow(months, "seasonal");

    // Get forecast with alerts
    const { forecast, alerts } = await ForecastingEngine.getCashFlowForecastWithAlerts(forecastId);

    // Format response
    const predictions = forecast.predictions as Record<string, number>;
    const avgCashFlow =
      Object.values(predictions).reduce((sum, val) => sum + val, 0) / Object.values(predictions).length;

    let content = `Cash flow prediction for next ${months} months:\n\n`;
    content += `💵 Average predicted cash flow: PKR ${avgCashFlow.toFixed(0)}\n`;
    content += `📊 Trend: ${forecast.trend_direction}\n\n`;

    if (alerts.length > 0) {
      content += "⚠️ ALERTS:\n\n";
      alerts.slice(0, 3).forEach((alert: any) => {
        const severityEmoji =
          alert.severity === "critical" ? "🔴" : alert.severity === "high" ? "🟠" : alert.severity === "medium" ? "🟡" : "🟢";
        content += `${severityEmoji} ${alert.message}\n`;
      });
      content += "\n";
    }

    if (forecast.recommendations && forecast.recommendations.length > 0) {
      content += "Immediate actions required:\n";
      forecast.recommendations.slice(0, 4).forEach((rec: string, i: number) => {
        content += `${i + 1}. ${rec}\n`;
      });
    }

    return {
      content,
      type: "recommendation",
      metadata: {
        forecastId,
        alerts: alerts.length,
        critical: alerts.filter((a: any) => a.severity === "critical").length,
      },
    };
  }

  /**
   * Handle commission optimization queries
   */
  private static async handleCommissionOptimization(query: string): Promise<AIQueryResponse> {
    // Run optimization analysis
    const result = await OptimizationEngine.optimizeCommissionRates();

    // Format response
    let content = `Commission rate optimization analysis complete:\n\n`;
    content += `📊 Analyzed ${result.total_vendors_analyzed} vendors\n`;
    content += `💡 Found ${result.recommendations.length} optimization opportunities\n\n`;

    if (result.recommendations.length > 0) {
      content += "Top recommendations:\n\n";

      result.recommendations.slice(0, 3).forEach((rec, i) => {
        const changeDirection = rec.rate_change_percent > 0 ? "Increase" : "Reduce";
        const changeSymbol = rec.rate_change_percent > 0 ? "+" : "";

        content += `${i + 1}. ${rec.vendor_name}: ${changeDirection} rate from ${(rec.current_rate * 100).toFixed(1)}% to ${(rec.recommended_rate * 100).toFixed(1)}% (${changeSymbol}${rec.rate_change_percent.toFixed(1)}%)\n`;
        content += `   • Projected profit increase: PKR ${rec.projected_impact.profit_change.toFixed(0)}/month\n`;
        content += `   • Risk level: ${rec.risk_level}\n`;
        content += `   • Reasoning: ${rec.reasoning[0]}\n\n`;
      });

      content += `Total projected impact: +PKR ${result.aggregate_impact.total_profit_impact.toFixed(0)}/month profit`;
    } else {
      content += "All vendor commission rates are currently optimal. No changes recommended at this time.";
    }

    return {
      content,
      type: "recommendation",
      metadata: {
        vendors: result.recommendations.length,
        impact: result.aggregate_impact.total_profit_impact,
      },
    };
  }

  /**
   * Handle anomaly detection queries
   */
  private static async handleAnomalyDetection(query: string): Promise<AIQueryResponse> {
    // Get recent anomalies
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const anomalies = await AnomalyDetector.getAnomalies({
      startDate,
      endDate,
      status: "open",
    });

    // Get anomaly stats
    const stats = await AnomalyDetector.getAnomalyStats(startDate, endDate);

    // Format response
    let content = `Anomaly detection scan complete:\n\n`;
    content += `🔍 Found ${anomalies.length} anomalies in last 7 days\n`;
    content += `⚠️ Critical: ${stats.bySeverity.critical}, High: ${stats.bySeverity.high}, Medium: ${stats.bySeverity.medium}\n\n`;

    if (anomalies.length > 0) {
      const criticalAnomalies = anomalies.filter((a) => a.severity === "critical" || a.severity === "high");

      if (criticalAnomalies.length > 0) {
        content += "Priority anomalies:\n\n";

        criticalAnomalies.slice(0, 3).forEach((anomaly, i) => {
          const severityEmoji =
            anomaly.severity === "critical" ? "🔴" : anomaly.severity === "high" ? "🟠" : "🟡";

          content += `${i + 1}. ${severityEmoji} ${anomaly.anomaly_type.toUpperCase()}: ${anomaly.description}\n`;
          content += `   • Amount: PKR ${anomaly.actual_value.toFixed(0)}\n`;

          if (anomaly.deviation_percent) {
            content += `   • Deviation: ${anomaly.deviation_percent.toFixed(1)}%\n`;
          }

          if (anomaly.suggested_actions && anomaly.suggested_actions.length > 0) {
            content += `   • Action: ${anomaly.suggested_actions[0]}\n`;
          }

          content += "\n";
        });

        content += "All anomalies flagged for investigation.";
      } else {
        content += "All detected anomalies are low priority. No immediate action required.";
      }
    } else {
      content += "✅ No anomalies detected. All transactions appear normal.";
    }

    return {
      content,
      type: "recommendation",
      metadata: {
        anomalies: anomalies.length,
        critical: stats.bySeverity.critical,
      },
    };
  }

  /**
   * Handle P&L queries
   */
  private static async handleProfitLoss(query: string): Promise<AIQueryResponse> {
    // Get current month P&L data
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split("T")[0];
    const endDate = currentDate.toISOString().split("T")[0];

    // Get revenue
    const { data: revenueData } = await supabase
      .from("finance_journal_entries")
      .select(
        `
        finance_ledger_entries!inner(
          credit,
          finance_accounts!inner(type)
        )
      `
      )
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .eq("finance_ledger_entries.finance_accounts.type", "revenue");

    const totalRevenue =
      revenueData?.reduce((sum, entry: any) => {
        return (
          sum +
          entry.finance_ledger_entries.reduce((entrySum: number, le: any) => entrySum + (le.credit || 0), 0)
        );
      }, 0) || 0;

    // Get expenses
    const { data: expenseData } = await supabase
      .from("finance_journal_entries")
      .select(
        `
        finance_ledger_entries!inner(
          debit,
          finance_accounts!inner(type)
        )
      `
      )
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .eq("finance_ledger_entries.finance_accounts.type", "expense");

    const totalExpenses =
      expenseData?.reduce((sum, entry: any) => {
        return (
          sum +
          entry.finance_ledger_entries.reduce((entrySum: number, le: any) => entrySum + (le.debit || 0), 0)
        );
      }, 0) || 0;

    // Calculate metrics
    const netIncome = totalRevenue - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const trendEmoji = netIncome > 0 ? "📈" : "📉";

    // Format response
    let content = `Profit & Loss summary for current month:\n\n`;
    content += `💰 Revenue: PKR ${totalRevenue.toFixed(0)}\n`;
    content += `💸 Expenses: PKR ${totalExpenses.toFixed(0)}\n`;
    content += `${trendEmoji} Net Income: PKR ${netIncome.toFixed(0)}\n`;
    content += `📊 Net Margin: ${netMargin.toFixed(1)}%\n\n`;

    if (netMargin > 20) {
      content += "✅ Strong profitability. Consider strategic investments or expansion.";
    } else if (netMargin > 10) {
      content += "✓ Healthy profit margin. Monitor expenses and look for efficiency gains.";
    } else if (netMargin > 0) {
      content += "⚠️ Low profit margin. Review expense categories and pricing strategy.";
    } else {
      content += "🔴 Operating at a loss. Immediate cost reduction and revenue improvement needed.";
    }

    return {
      content,
      type: "text",
      metadata: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netIncome,
        netMargin,
      },
    };
  }

  /**
   * Handle budget queries
   */
  private static async handleBudget(query: string): Promise<AIQueryResponse> {
    // Get current fiscal year budgets
    const currentYear = new Date().getFullYear();

    const { data: budgets } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("fiscal_year", currentYear)
      .eq("status", "active");

    if (!budgets || budgets.length === 0) {
      return {
        content: "No active budgets found for the current fiscal year. Create a budget to start tracking spending.",
        type: "text",
      };
    }

    // Calculate overall utilization
    const totalBudget = budgets.reduce((sum, b) => sum + b.total_amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0);
    const overallUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Find budgets exceeding 90%
    const highUtilization = budgets.filter((b) => {
      const utilization = b.total_amount > 0 ? (b.spent_amount / b.total_amount) * 100 : 0;
      return utilization >= 90;
    });

    // Format response
    let content = `Budget utilization summary:\n\n`;
    content += `📊 Overall: ${overallUtilization.toFixed(0)}% utilized (PKR ${(totalSpent / 1000).toFixed(0)}K of PKR ${(totalBudget / 1000).toFixed(0)}K)\n\n`;

    if (highUtilization.length > 0) {
      content += `⚠️ Departments exceeding 90%:\n`;
      highUtilization.forEach((budget) => {
        const utilization = budget.total_amount > 0 ? (budget.spent_amount / budget.total_amount) * 100 : 0;
        content += `• ${budget.department_id || "General"}: ${utilization.toFixed(0)}% (PKR ${(budget.spent_amount / 1000).toFixed(0)}K of PKR ${(budget.total_amount / 1000).toFixed(0)}K)\n`;
      });
      content += "\n";
    }

    const onTrack = budgets.filter((b) => {
      const utilization = b.total_amount > 0 ? (b.spent_amount / b.total_amount) * 100 : 0;
      return utilization < 90;
    });

    if (onTrack.length > 0) {
      content += `✅ Departments on track:\n`;
      onTrack.slice(0, 3).forEach((budget) => {
        const utilization = budget.total_amount > 0 ? (budget.spent_amount / budget.total_amount) * 100 : 0;
        content += `• ${budget.department_id || "General"}: ${utilization.toFixed(0)}% (PKR ${(budget.spent_amount / 1000).toFixed(0)}K of PKR ${(budget.total_amount / 1000).toFixed(0)}K)\n`;
      });
      content += "\n";
    }

    if (highUtilization.length > 0) {
      content += "Recommendations:\n";
      content += "1. Review high-utilization departments for Q4\n";
      content += "2. Consider budget reallocation from underutilized departments\n";
      content += "3. Monitor closely to avoid overruns";
    }

    return {
      content,
      type: "recommendation",
      metadata: {
        totalBudget,
        totalSpent,
        utilization: overallUtilization,
        highUtilization: highUtilization.length,
      },
    };
  }

  /**
   * Extract number of months from query
   */
  private static extractMonths(query: string): number | null {
    // Look for patterns like "6 months", "next 3 months", "12 month"
    const monthMatch = query.match(/(\d+)\s*month/i);
    if (monthMatch) {
      const months = parseInt(monthMatch[1], 10);
      return months >= 1 && months <= 24 ? months : null;
    }

    // Look for quarter references
    if (query.includes("quarter")) {
      return 3;
    }

    // Look for year references
    if (query.includes("year")) {
      return 12;
    }

    return null;
  }

  /**
   * Get default response for unrecognized queries
   */
  private static getDefaultResponse(): AIQueryResponse {
    return {
      content: `I can help you with:\n\n• Revenue forecasting and trend analysis\n• Cash flow predictions and alerts\n• Commission rate optimization\n• Financial anomaly detection\n• P&L and budget analysis\n• Vendor profitability insights\n\nPlease ask me a specific question about any of these topics, or use the quick actions above.`,
      type: "text",
    };
  }
}
