import { supabase } from "@/integrations/supabase/client";

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CurrencyConversion {
  from_currency: string;
  to_currency: string;
  original_amount: number;
  converted_amount: number;
  exchange_rate: number;
  conversion_date: string;
}

export interface FXTransaction {
  id: string;
  transaction_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  fx_gain_loss: number;
  transaction_date: string;
}

export class MultiCurrencyManager {
  // Base currency for the system
  static readonly BASE_CURRENCY = "PKR";

  // Common currencies for Pakistan business context
  static readonly SUPPORTED_CURRENCIES = [
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰" },
    { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
    { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
    { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
    { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  ];

  /**
   * Convert currency amount using historical exchange rate
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ): Promise<CurrencyConversion> {
    // Validate inputs
    if (amount < 0) {
      throw new Error("Amount cannot be negative");
    }

    if (!fromCurrency || !toCurrency) {
      throw new Error("Currency codes are required");
    }

    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        original_amount: amount,
        converted_amount: amount,
        exchange_rate: 1.0,
        conversion_date: date || new Date().toISOString().split("T")[0],
      };
    }

    const conversionDate = date || new Date().toISOString().split("T")[0];

    // Get exchange rate using database function
    const { data, error } = await supabase.rpc("get_exchange_rate", {
      p_from_currency: fromCurrency,
      p_to_currency: toCurrency,
      p_date: conversionDate,
    });

    if (error) {
      throw new Error(`Failed to get exchange rate: ${error.message}`);
    }

    if (!data) {
      throw new Error(
        `No exchange rate found for ${fromCurrency} to ${toCurrency} on ${conversionDate}`
      );
    }

    const exchangeRate = parseFloat(data);
    const convertedAmount = amount * exchangeRate;

    return {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      original_amount: amount,
      converted_amount: convertedAmount,
      exchange_rate: exchangeRate,
      conversion_date: conversionDate,
    };
  }

  /**
   * Get exchange rate for currency pair on specific date
   */
  static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ): Promise<number> {
    // Validate inputs
    if (!fromCurrency || !toCurrency) {
      throw new Error("Currency codes are required");
    }

    // If same currency, return 1
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const rateDate = date || new Date().toISOString().split("T")[0];

    // Get exchange rate using database function
    const { data, error } = await supabase.rpc("get_exchange_rate", {
      p_from_currency: fromCurrency,
      p_to_currency: toCurrency,
      p_date: rateDate,
    });

    if (error) {
      throw new Error(`Failed to get exchange rate: ${error.message}`);
    }

    if (!data) {
      throw new Error(
        `No exchange rate found for ${fromCurrency} to ${toCurrency} on ${rateDate}`
      );
    }

    return parseFloat(data);
  }

  /**
   * Record FX transaction for tracking gains/losses
   */
  static async recordFXTransaction(
    transactionId: string,
    fromCurrency: string,
    toCurrency: string,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number,
    transactionDate: string
  ): Promise<string> {
    // Validate inputs
    if (!transactionId || transactionId.trim().length === 0) {
      throw new Error("Transaction ID is required");
    }

    if (!fromCurrency || !toCurrency) {
      throw new Error("Currency codes are required");
    }

    if (fromAmount < 0 || toAmount < 0) {
      throw new Error("Amounts cannot be negative");
    }

    if (exchangeRate <= 0) {
      throw new Error("Exchange rate must be positive");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(transactionDate)) {
      throw new Error("Transaction date must be in YYYY-MM-DD format");
    }

    // Calculate FX gain/loss (difference between expected and actual conversion)
    const expectedAmount = fromAmount * exchangeRate;
    const fxGainLoss = toAmount - expectedAmount;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Insert FX transaction record
    const { data, error } = await supabase
      .from("finance_fx_transactions")
      .insert({
        transaction_id: transactionId,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: fromAmount,
        to_amount: toAmount,
        exchange_rate: exchangeRate,
        fx_gain_loss: fxGainLoss,
        transaction_date: transactionDate,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to record FX transaction: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Calculate FX gain/loss for a period
   */
  static async getFXGainLoss(
    startDate: string,
    endDate: string,
    currency?: string
  ): Promise<{
    total_gain_loss: number;
    by_currency: Record<string, number>;
    transactions: FXTransaction[];
  }> {
    // Validate inputs
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Build query
    let query = supabase
      .from("finance_fx_transactions")
      .select("*")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: false });

    if (currency) {
      query = query.or(`from_currency.eq.${currency},to_currency.eq.${currency}`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch FX transactions: ${error.message}`);
    }

    const transactions = (data || []) as FXTransaction[];

    // Calculate totals
    const totalGainLoss = transactions.reduce((sum, tx) => sum + tx.fx_gain_loss, 0);

    // Group by currency
    const byCurrency: Record<string, number> = {};
    transactions.forEach((tx) => {
      const key = `${tx.from_currency}/${tx.to_currency}`;
      byCurrency[key] = (byCurrency[key] || 0) + tx.fx_gain_loss;
    });

    return {
      total_gain_loss: totalGainLoss,
      by_currency: byCurrency,
      transactions,
    };
  }

  /**
   * Get latest exchange rates for all supported currencies
   */
  static async getLatestRates(baseCurrency: string = this.BASE_CURRENCY): Promise<
    Record<string, { rate: number; date: string }>
  > {
    const rates: Record<string, { rate: number; date: string }> = {};

    // Get rates for all supported currencies
    for (const currency of this.SUPPORTED_CURRENCIES) {
      if (currency.code === baseCurrency) {
        rates[currency.code] = { rate: 1.0, date: new Date().toISOString().split("T")[0] };
        continue;
      }

      try {
        const { data, error } = await supabase
          .from("finance_exchange_rates")
          .select("rate, rate_date")
          .eq("from_currency", baseCurrency)
          .eq("to_currency", currency.code)
          .order("rate_date", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          rates[currency.code] = {
            rate: parseFloat(data.rate),
            date: data.rate_date,
          };
        }
      } catch (err) {
        // Skip currencies without rates
        console.warn(`No rate found for ${baseCurrency} to ${currency.code}`);
      }
    }

    return rates;
  }

  /**
   * Format currency amount with symbol
   */
  static formatCurrency(amount: number, currencyCode: string): string {
    const currency = this.SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
    const symbol = currency?.symbol || currencyCode;

    // Format with thousand separators
    const formatted = new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${symbol} ${formatted}`;
  }

  /**
   * Get currency info by code
   */
  static getCurrencyInfo(code: string) {
    return this.SUPPORTED_CURRENCIES.find((c) => c.code === code);
  }

  /**
   * Convert amount to base currency (PKR)
   */
  static async convertToBaseCurrency(
    amount: number,
    fromCurrency: string,
    date?: string
  ): Promise<CurrencyConversion> {
    return this.convertCurrency(amount, fromCurrency, this.BASE_CURRENCY, date);
  }

  /**
   * Convert amount from base currency (PKR) to target currency
   */
  static async convertFromBaseCurrency(
    amount: number,
    toCurrency: string,
    date?: string
  ): Promise<CurrencyConversion> {
    return this.convertCurrency(amount, this.BASE_CURRENCY, toCurrency, date);
  }

  /**
   * Batch convert multiple amounts to base currency
   */
  static async batchConvertToBase(
    conversions: Array<{ amount: number; currency: string; date?: string }>
  ): Promise<CurrencyConversion[]> {
    const results: CurrencyConversion[] = [];

    for (const conv of conversions) {
      try {
        const result = await this.convertToBaseCurrency(
          conv.amount,
          conv.currency,
          conv.date
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to convert ${conv.amount} ${conv.currency}:`, error);
        // Add failed conversion with original amount
        results.push({
          from_currency: conv.currency,
          to_currency: this.BASE_CURRENCY,
          original_amount: conv.amount,
          converted_amount: conv.amount, // Fallback to original
          exchange_rate: 1.0,
          conversion_date: conv.date || new Date().toISOString().split("T")[0],
        });
      }
    }

    return results;
  }
}
