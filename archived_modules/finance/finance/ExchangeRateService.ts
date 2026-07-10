import { supabase } from "@/integrations/supabase/client";

/**
 * Exchange Rate Service
 * 
 * Provides exchange rate management functionality including:
 * - Fetching rates from external APIs with fallback support
 * - Storing historical exchange rates
 * - Retrieving rates for specific dates
 * - Automatic daily rate updates
 */

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
  created_at: string;
}

export interface ExchangeRateProvider {
  name: string;
  fetchRates: (baseCurrency: string) => Promise<Record<string, number>>;
}

// =====================================================
// Exchange Rate Providers
// =====================================================

/**
 * ExchangeRate-API.com provider (Free tier: 1,500 requests/month)
 * https://www.exchangerate-api.com/
 */
const exchangeRateApiProvider: ExchangeRateProvider = {
  name: "exchangerate-api",
  fetchRates: async (baseCurrency: string) => {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
    );
    
    if (!response.ok) {
      throw new Error(`ExchangeRate-API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.rates;
  },
};

/**
 * Frankfurter API provider (Free, no API key required)
 * https://www.frankfurter.app/
 */
const frankfurterProvider: ExchangeRateProvider = {
  name: "frankfurter",
  fetchRates: async (baseCurrency: string) => {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${baseCurrency}`
    );
    
    if (!response.ok) {
      throw new Error(`Frankfurter API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.rates;
  },
};

/**
 * Fixer.io fallback provider (Requires API key)
 * https://fixer.io/
 */
const fixerProvider: ExchangeRateProvider = {
  name: "fixer",
  fetchRates: async (baseCurrency: string) => {
    const apiKey = import.meta.env.VITE_FIXER_API_KEY;
    
    if (!apiKey) {
      throw new Error("Fixer API key not configured");
    }
    
    const response = await fetch(
      `https://api.fixer.io/latest?access_key=${apiKey}&base=${baseCurrency}`
    );
    
    if (!response.ok) {
      throw new Error(`Fixer API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Fixer API error: ${data.error?.info || "Unknown error"}`);
    }
    
    return data.rates;
  },
};

// Provider chain with fallback order
const PROVIDERS: ExchangeRateProvider[] = [
  exchangeRateApiProvider,
  frankfurterProvider,
  fixerProvider,
];

// =====================================================
// Exchange Rate Fetching with Fallback
// =====================================================

/**
 * Fetch exchange rates with automatic fallback to multiple providers
 */
export async function fetchExchangeRatesWithFallback(
  baseCurrency: string = "PKR"
): Promise<{
  rates: Record<string, number>;
  source: string;
  error?: string;
}> {
  const errors: string[] = [];
  
  for (const provider of PROVIDERS) {
    try {
      console.log(`Attempting to fetch rates from ${provider.name}...`);
      const rates = await provider.fetchRates(baseCurrency);
      
      // Validate rates
      if (!rates || Object.keys(rates).length === 0) {
        throw new Error("No rates returned");
      }
      
      console.log(`Successfully fetched rates from ${provider.name}`);
      return {
        rates,
        source: provider.name,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`${provider.name} failed:`, errorMsg);
      errors.push(`${provider.name}: ${errorMsg}`);
    }
  }
  
  // All providers failed
  return {
    rates: {},
    source: "none",
    error: `All providers failed: ${errors.join("; ")}`,
  };
}

// =====================================================
// Database Operations
// =====================================================

/**
 * Store exchange rates in the database
 */
export async function storeExchangeRates(
  baseCurrency: string,
  rates: Record<string, number>,
  source: string,
  rateDate?: Date
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const date = rateDate || new Date();
    const dateString = date.toISOString().split("T")[0];
    
    // Prepare rate records
    const rateRecords = Object.entries(rates).map(([toCurrency, rate]) => ({
      from_currency: baseCurrency,
      to_currency: toCurrency,
      rate,
      rate_date: dateString,
      source,
    }));
    
    // Also add inverse rates (e.g., if we have PKR->USD, add USD->PKR)
    const inverseRecords = Object.entries(rates).map(([toCurrency, rate]) => ({
      from_currency: toCurrency,
      to_currency: baseCurrency,
      rate: 1 / rate,
      rate_date: dateString,
      source,
    }));
    
    const allRecords = [...rateRecords, ...inverseRecords];
    
    // Upsert rates (update if exists, insert if not)
    const { error, count } = await supabase
      .from("finance_exchange_rates")
      .upsert(allRecords, {
        onConflict: "from_currency,to_currency,rate_date",
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error("Error storing exchange rates:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, count: count || allRecords.length };
  } catch (error) {
    console.error("Unexpected error storing exchange rates:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get exchange rate for a specific date
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<{ data: ExchangeRate | null; error?: string }> {
  try {
    const dateString = date
      ? date.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    
    const { data, error } = await supabase
      .from("finance_exchange_rates")
      .select("*")
      .eq("from_currency", fromCurrency)
      .eq("to_currency", toCurrency)
      .eq("rate_date", dateString)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching exchange rate:", error);
      return { data: null, error: error.message };
    }
    
    return { data: data as ExchangeRate | null };
  } catch (error) {
    console.error("Unexpected error fetching exchange rate:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get historical exchange rates for a currency pair
 */
export async function getHistoricalRates(
  fromCurrency: string,
  toCurrency: string,
  startDate: Date,
  endDate: Date
): Promise<{ data: ExchangeRate[]; error?: string }> {
  try {
    const startDateString = startDate.toISOString().split("T")[0];
    const endDateString = endDate.toISOString().split("T")[0];
    
    const { data, error } = await supabase
      .from("finance_exchange_rates")
      .select("*")
      .eq("from_currency", fromCurrency)
      .eq("to_currency", toCurrency)
      .gte("rate_date", startDateString)
      .lte("rate_date", endDateString)
      .order("rate_date", { ascending: true });
    
    if (error) {
      console.error("Error fetching historical rates:", error);
      return { data: [], error: error.message };
    }
    
    return { data: data as ExchangeRate[] };
  } catch (error) {
    console.error("Unexpected error fetching historical rates:", error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update daily exchange rates (called by cron job or manually)
 */
export async function updateDailyExchangeRates(
  baseCurrency: string = "PKR"
): Promise<{
  success: boolean;
  source?: string;
  count?: number;
  error?: string;
}> {
  try {
    console.log(`Updating daily exchange rates for ${baseCurrency}...`);
    
    // Fetch rates with fallback
    const { rates, source, error: fetchError } = await fetchExchangeRatesWithFallback(baseCurrency);
    
    if (fetchError || Object.keys(rates).length === 0) {
      return {
        success: false,
        error: fetchError || "No rates fetched",
      };
    }
    
    // Store rates in database
    const { success, error: storeError, count } = await storeExchangeRates(
      baseCurrency,
      rates,
      source
    );
    
    if (!success) {
      return {
        success: false,
        error: storeError,
      };
    }
    
    console.log(`Successfully updated ${count} exchange rates from ${source}`);
    
    return {
      success: true,
      source,
      count,
    };
  } catch (error) {
    console.error("Unexpected error updating daily exchange rates:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the latest available exchange rate (fallback to most recent if today's not available)
 */
export async function getLatestExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<{ data: ExchangeRate | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("finance_exchange_rates")
      .select("*")
      .eq("from_currency", fromCurrency)
      .eq("to_currency", toCurrency)
      .order("rate_date", { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching latest exchange rate:", error);
      return { data: null, error: error.message };
    }
    
    return { data: data as ExchangeRate | null };
  } catch (error) {
    console.error("Unexpected error fetching latest exchange rate:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate exchange rate for reasonableness
 */
export function validateExchangeRate(
  rate: number,
  fromCurrency: string,
  toCurrency: string
): { valid: boolean; reason?: string } {
  // Rate must be positive
  if (rate <= 0) {
    return { valid: false, reason: "Rate must be positive" };
  }
  
  // Rate must be finite
  if (!isFinite(rate)) {
    return { valid: false, reason: "Rate must be finite" };
  }
  
  // Reasonable bounds check (rates should be between 0.0001 and 10000)
  if (rate < 0.0001 || rate > 10000) {
    return {
      valid: false,
      reason: `Rate ${rate} is outside reasonable bounds (0.0001 - 10000)`,
    };
  }
  
  return { valid: true };
}
