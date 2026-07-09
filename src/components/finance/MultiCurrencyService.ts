/**
 * Multi-Currency Service
 * 
 * Comprehensive currency conversion and FX management
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.6, 17.7, 17.8
 * Tasks: 46.4, 46.5
 */

import { supabase } from '@/integrations/supabase/client';
import { getExchangeRate, getLatestExchangeRate } from './ExchangeRateService';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export interface CurrencyConversionResult {
  success: boolean;
  convertedAmount?: number;
  rate?: number;
  rateDate?: string;
  error?: string;
  warning?: string;
}

export interface FXTransaction {
  id: string;
  transactionDate: Date;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  sourceTransactionId?: string;
  sourceModule?: string;
  createdAt: Date;
}

export interface FXGainLoss {
  transactionId: string;
  gainLossAmount: number;
  gainLossPercentage: number;
  originalRate: number;
  currentRate: number;
  fromCurrency: string;
  toCurrency: string;
}

// =====================================================
// Multi-Currency Service
// =====================================================

export class MultiCurrencyService {
  /**
   * Convert amount using historical rates
   * Use transaction date for rate lookup
   * Handle missing rates with alerts
   * 
   * Task: 46.4
   * Requirements: 17.1, 17.3, 17.6
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    transactionDate?: Date
  ): Promise<CurrencyConversionResult> {
    try {
      // Same currency - no conversion needed
      if (fromCurrency === toCurrency) {
        return {
          success: true,
          convertedAmount: amount,
          rate: 1,
          rateDate: transactionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        };
      }

      // Validate amount
      if (amount < 0) {
        return {
          success: false,
          error: 'Amount must be non-negative',
        };
      }

      // Get exchange rate for the transaction date
      const { data: rateData, error: rateError } = await getExchangeRate(
        fromCurrency,
        toCurrency,
        transactionDate
      );

      if (rateError) {
        return {
          success: false,
          error: `Failed to fetch exchange rate: ${rateError}`,
        };
      }

      // If rate not found for specific date, try latest rate
      if (!rateData) {
        const { data: latestRate, error: latestError } = await getLatestExchangeRate(
          fromCurrency,
          toCurrency
        );

        if (latestError || !latestRate) {
          // Alert user about missing rate
          const dateStr = transactionDate?.toISOString().split('T')[0] || 'today';
          const alertMessage = `Exchange rate not available for ${fromCurrency} to ${toCurrency} on ${dateStr}. Please update exchange rates.`;
          
          toast.error('Missing Exchange Rate', {
            description: alertMessage,
          });

          return {
            success: false,
            error: alertMessage,
          };
        }

        // Use latest rate with warning
        const convertedAmount = amount * latestRate.rate;
        const warningMessage = `Using latest available rate from ${latestRate.rate_date} (requested date: ${transactionDate?.toISOString().split('T')[0] || 'today'})`;
        
        toast.warning('Using Latest Rate', {
          description: warningMessage,
        });

        return {
          success: true,
          convertedAmount,
          rate: latestRate.rate,
          rateDate: latestRate.rate_date,
          warning: warningMessage,
        };
      }

      // Convert using historical rate
      const convertedAmount = amount * rateData.rate;

      return {
        success: true,
        convertedAmount,
        rate: rateData.rate,
        rateDate: rateData.rate_date,
      };
    } catch (error) {
      console.error('Error converting currency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate FX gains and losses
   * Record FX transactions
   * 
   * Task: 46.5
   * Requirements: 17.7, 17.8
   */
  async calculateFXGainLoss(
    transactionId: string,
    fromCurrency: string,
    toCurrency: string,
    originalAmount: number,
    originalRate: number,
    originalDate: Date
  ): Promise<{ success: boolean; gainLoss?: FXGainLoss; error?: string }> {
    try {
      // Get current exchange rate
      const { data: currentRateData, error: rateError } = await getLatestExchangeRate(
        fromCurrency,
        toCurrency
      );

      if (rateError || !currentRateData) {
        return {
          success: false,
          error: `Failed to fetch current exchange rate: ${rateError}`,
        };
      }

      const currentRate = currentRateData.rate;

      // Calculate gain/loss
      const originalValue = originalAmount * originalRate;
      const currentValue = originalAmount * currentRate;
      const gainLossAmount = currentValue - originalValue;
      const gainLossPercentage = ((currentRate - originalRate) / originalRate) * 100;

      const gainLoss: FXGainLoss = {
        transactionId,
        gainLossAmount,
        gainLossPercentage,
        originalRate,
        currentRate,
        fromCurrency,
        toCurrency,
      };

      return {
        success: true,
        gainLoss,
      };
    } catch (error) {
      console.error('Error calculating FX gain/loss:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record FX transaction in the database
   * 
   * Task: 46.5
   * Requirements: 17.7, 17.8
   */
  async recordFXTransaction(
    fromCurrency: string,
    toCurrency: string,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number,
    transactionDate: Date,
    sourceTransactionId?: string,
    sourceModule?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Insert FX transaction record
      const { data, error } = await supabase
        .from('finance_fx_transactions')
        .insert({
          transaction_date: transactionDate.toISOString().split('T')[0],
          from_currency: fromCurrency,
          to_currency: toCurrency,
          from_amount: fromAmount,
          to_amount: toAmount,
          exchange_rate: exchangeRate,
          source_transaction_id: sourceTransactionId,
          source_module: sourceModule,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording FX transaction:', error);
        return {
          success: false,
          error: `Failed to record FX transaction: ${error.message}`,
        };
      }

      return {
        success: true,
        transactionId: data.id,
      };
    } catch (error) {
      console.error('Error recording FX transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get FX transactions for a period
   */
  async getFXTransactions(
    startDate: Date,
    endDate: Date,
    currency?: string
  ): Promise<{ success: boolean; transactions?: FXTransaction[]; error?: string }> {
    try {
      let query = supabase
        .from('finance_fx_transactions')
        .select('*')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (currency) {
        query = query.or(`from_currency.eq.${currency},to_currency.eq.${currency}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching FX transactions:', error);
        return {
          success: false,
          error: `Failed to fetch FX transactions: ${error.message}`,
        };
      }

      const transactions: FXTransaction[] = (data || []).map((tx: any) => ({
        id: tx.id,
        transactionDate: new Date(tx.transaction_date),
        fromCurrency: tx.from_currency,
        toCurrency: tx.to_currency,
        fromAmount: tx.from_amount,
        toAmount: tx.to_amount,
        exchangeRate: tx.exchange_rate,
        sourceTransactionId: tx.source_transaction_id,
        sourceModule: tx.source_module,
        createdAt: new Date(tx.created_at),
      }));

      return {
        success: true,
        transactions,
      };
    } catch (error) {
      console.error('Error fetching FX transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get total FX gain/loss for a period
   */
  async getTotalFXGainLoss(
    startDate: Date,
    endDate: Date,
    baseCurrency: string = 'PKR'
  ): Promise<{ success: boolean; totalGainLoss?: number; error?: string }> {
    try {
      const { success, transactions, error } = await this.getFXTransactions(
        startDate,
        endDate
      );

      if (!success || !transactions) {
        return {
          success: false,
          error: error || 'Failed to fetch FX transactions',
        };
      }

      let totalGainLoss = 0;

      // Calculate gain/loss for each transaction
      for (const tx of transactions) {
        const { success: calcSuccess, gainLoss } = await this.calculateFXGainLoss(
          tx.id,
          tx.fromCurrency,
          tx.toCurrency,
          tx.fromAmount,
          tx.exchangeRate,
          tx.transactionDate
        );

        if (calcSuccess && gainLoss) {
          // Convert gain/loss to base currency if needed
          if (tx.toCurrency === baseCurrency) {
            totalGainLoss += gainLoss.gainLossAmount;
          } else {
            // Convert to base currency
            const { success: convSuccess, convertedAmount } = await this.convertCurrency(
              gainLoss.gainLossAmount,
              tx.toCurrency,
              baseCurrency,
              new Date()
            );

            if (convSuccess && convertedAmount !== undefined) {
              totalGainLoss += convertedAmount;
            }
          }
        }
      }

      return {
        success: true,
        totalGainLoss,
      };
    } catch (error) {
      console.error('Error calculating total FX gain/loss:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch convert multiple amounts
   */
  async batchConvertCurrency(
    conversions: Array<{
      amount: number;
      fromCurrency: string;
      toCurrency: string;
      transactionDate?: Date;
    }>
  ): Promise<{
    success: boolean;
    results?: CurrencyConversionResult[];
    error?: string;
  }> {
    try {
      const results: CurrencyConversionResult[] = [];

      for (const conversion of conversions) {
        const result = await this.convertCurrency(
          conversion.amount,
          conversion.fromCurrency,
          conversion.toCurrency,
          conversion.transactionDate
        );
        results.push(result);
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('Error in batch currency conversion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const multiCurrencyService = new MultiCurrencyService();
