/**
 * Multi-Currency Report Service
 * 
 * Generate financial reports with multi-currency support
 * 
 * Requirements: 17.9, 17.10
 * Task: 46.6
 */

import { supabase } from '@/integrations/supabase/client';
import { multiCurrencyService } from './MultiCurrencyService';

// =====================================================
// Types
// =====================================================

export interface MultiCurrencyRevenueReport {
  period: string;
  baseCurrency: string;
  revenueByCurrency: Array<{
    currency: string;
    amount: number;
    amountInBaseCurrency: number;
    percentage: number;
  }>;
  totalRevenue: number;
  fxGainLoss: number;
}

export interface MultiCurrencyExpenseReport {
  period: string;
  baseCurrency: string;
  expensesByCurrency: Array<{
    currency: string;
    amount: number;
    amountInBaseCurrency: number;
    percentage: number;
  }>;
  totalExpenses: number;
  fxGainLoss: number;
}

export interface MultiCurrencyPLReport {
  period: string;
  baseCurrency: string;
  revenue: MultiCurrencyRevenueReport;
  expenses: MultiCurrencyExpenseReport;
  netIncome: number;
  fxGainLoss: number;
}

// =====================================================
// Multi-Currency Report Service
// =====================================================

export class MultiCurrencyReportService {
  /**
   * Generate multi-currency revenue report
   * Convert all amounts to base currency
   * Show revenue by currency
   * Display FX gain/loss
   * 
   * Task: 46.6
   * Requirements: 17.9, 17.10
   */
  async generateRevenueReport(
    startDate: Date,
    endDate: Date,
    baseCurrency: string = 'PKR'
  ): Promise<{
    success: boolean;
    report?: MultiCurrencyRevenueReport;
    error?: string;
  }> {
    try {
      // Get revenue transactions grouped by currency
      const { data: revenueData, error: revenueError } = await supabase
        .from('finance_transactions')
        .select('amount, currency, transaction_date')
        .eq('type', 'revenue')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      if (revenueError) {
        return {
          success: false,
          error: `Failed to fetch revenue data: ${revenueError.message}`,
        };
      }

      // Group by currency and convert to base currency
      const revenueByCurrency = new Map<string, number>();
      const revenueInBaseCurrency = new Map<string, number>();

      for (const tx of revenueData || []) {
        const currency = tx.currency || baseCurrency;
        const amount = tx.amount || 0;

        // Accumulate in original currency
        revenueByCurrency.set(
          currency,
          (revenueByCurrency.get(currency) || 0) + amount
        );

        // Convert to base currency
        const { success, convertedAmount } = await multiCurrencyService.convertCurrency(
          amount,
          currency,
          baseCurrency,
          new Date(tx.transaction_date)
        );

        if (success && convertedAmount !== undefined) {
          revenueInBaseCurrency.set(
            currency,
            (revenueInBaseCurrency.get(currency) || 0) + convertedAmount
          );
        }
      }

      // Calculate total revenue in base currency
      const totalRevenue = Array.from(revenueInBaseCurrency.values()).reduce(
        (sum, amount) => sum + amount,
        0
      );

      // Get FX gain/loss for the period
      const { success: fxSuccess, totalGainLoss } =
        await multiCurrencyService.getTotalFXGainLoss(startDate, endDate, baseCurrency);

      const fxGainLoss = fxSuccess && totalGainLoss !== undefined ? totalGainLoss : 0;

      // Build report
      const revenueByCurrencyArray = Array.from(revenueByCurrency.entries()).map(
        ([currency, amount]) => ({
          currency,
          amount,
          amountInBaseCurrency: revenueInBaseCurrency.get(currency) || 0,
          percentage: totalRevenue > 0 ? ((revenueInBaseCurrency.get(currency) || 0) / totalRevenue) * 100 : 0,
        })
      );

      const report: MultiCurrencyRevenueReport = {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        baseCurrency,
        revenueByCurrency: revenueByCurrencyArray,
        totalRevenue,
        fxGainLoss,
      };

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error('Error generating revenue report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate multi-currency expense report
   */
  async generateExpenseReport(
    startDate: Date,
    endDate: Date,
    baseCurrency: string = 'PKR'
  ): Promise<{
    success: boolean;
    report?: MultiCurrencyExpenseReport;
    error?: string;
  }> {
    try {
      // Get expense transactions grouped by currency
      const { data: expenseData, error: expenseError } = await supabase
        .from('finance_expenses')
        .select('amount, currency, expense_date')
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0])
        .eq('status', 'approved');

      if (expenseError) {
        return {
          success: false,
          error: `Failed to fetch expense data: ${expenseError.message}`,
        };
      }

      // Group by currency and convert to base currency
      const expensesByCurrency = new Map<string, number>();
      const expensesInBaseCurrency = new Map<string, number>();

      for (const tx of expenseData || []) {
        const currency = tx.currency || baseCurrency;
        const amount = tx.amount || 0;

        // Accumulate in original currency
        expensesByCurrency.set(
          currency,
          (expensesByCurrency.get(currency) || 0) + amount
        );

        // Convert to base currency
        const { success, convertedAmount } = await multiCurrencyService.convertCurrency(
          amount,
          currency,
          baseCurrency,
          new Date(tx.expense_date)
        );

        if (success && convertedAmount !== undefined) {
          expensesInBaseCurrency.set(
            currency,
            (expensesInBaseCurrency.get(currency) || 0) + convertedAmount
          );
        }
      }

      // Calculate total expenses in base currency
      const totalExpenses = Array.from(expensesInBaseCurrency.values()).reduce(
        (sum, amount) => sum + amount,
        0
      );

      // Get FX gain/loss for the period
      const { success: fxSuccess, totalGainLoss } =
        await multiCurrencyService.getTotalFXGainLoss(startDate, endDate, baseCurrency);

      const fxGainLoss = fxSuccess && totalGainLoss !== undefined ? totalGainLoss : 0;

      // Build report
      const expensesByCurrencyArray = Array.from(expensesByCurrency.entries()).map(
        ([currency, amount]) => ({
          currency,
          amount,
          amountInBaseCurrency: expensesInBaseCurrency.get(currency) || 0,
          percentage: totalExpenses > 0 ? ((expensesInBaseCurrency.get(currency) || 0) / totalExpenses) * 100 : 0,
        })
      );

      const report: MultiCurrencyExpenseReport = {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        baseCurrency,
        expensesByCurrency: expensesByCurrencyArray,
        totalExpenses,
        fxGainLoss,
      };

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error('Error generating expense report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate comprehensive multi-currency P&L report
   */
  async generatePLReport(
    startDate: Date,
    endDate: Date,
    baseCurrency: string = 'PKR'
  ): Promise<{
    success: boolean;
    report?: MultiCurrencyPLReport;
    error?: string;
  }> {
    try {
      // Generate revenue report
      const { success: revenueSuccess, report: revenueReport, error: revenueError } =
        await this.generateRevenueReport(startDate, endDate, baseCurrency);

      if (!revenueSuccess || !revenueReport) {
        return {
          success: false,
          error: revenueError || 'Failed to generate revenue report',
        };
      }

      // Generate expense report
      const { success: expenseSuccess, report: expenseReport, error: expenseError } =
        await this.generateExpenseReport(startDate, endDate, baseCurrency);

      if (!expenseSuccess || !expenseReport) {
        return {
          success: false,
          error: expenseError || 'Failed to generate expense report',
        };
      }

      // Calculate net income
      const netIncome = revenueReport.totalRevenue - expenseReport.totalExpenses;

      // Total FX gain/loss
      const fxGainLoss = revenueReport.fxGainLoss + expenseReport.fxGainLoss;

      const report: MultiCurrencyPLReport = {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        baseCurrency,
        revenue: revenueReport,
        expenses: expenseReport,
        netIncome,
        fxGainLoss,
      };

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error('Error generating P&L report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export multi-currency report to CSV
   */
  exportToCSV(report: MultiCurrencyPLReport): string {
    const lines: string[] = [];

    // Header
    lines.push(`Multi-Currency P&L Report`);
    lines.push(`Period: ${report.period}`);
    lines.push(`Base Currency: ${report.baseCurrency}`);
    lines.push('');

    // Revenue section
    lines.push('Revenue by Currency');
    lines.push('Currency,Amount,Amount in Base Currency,Percentage');
    report.revenue.revenueByCurrency.forEach((item) => {
      lines.push(
        `${item.currency},${item.amount.toFixed(2)},${item.amountInBaseCurrency.toFixed(2)},${item.percentage.toFixed(2)}%`
      );
    });
    lines.push(`Total Revenue,,,${report.revenue.totalRevenue.toFixed(2)}`);
    lines.push('');

    // Expenses section
    lines.push('Expenses by Currency');
    lines.push('Currency,Amount,Amount in Base Currency,Percentage');
    report.expenses.expensesByCurrency.forEach((item) => {
      lines.push(
        `${item.currency},${item.amount.toFixed(2)},${item.amountInBaseCurrency.toFixed(2)},${item.percentage.toFixed(2)}%`
      );
    });
    lines.push(`Total Expenses,,,${report.expenses.totalExpenses.toFixed(2)}`);
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push(`Net Income,${report.netIncome.toFixed(2)}`);
    lines.push(`FX Gain/Loss,${report.fxGainLoss.toFixed(2)}`);

    return lines.join('\n');
  }
}

// Export singleton instance
export const multiCurrencyReportService = new MultiCurrencyReportService();
