import { supabase } from "@/integrations/supabase/client";

/**
 * Currency Service
 * 
 * Provides currency management functionality including:
 * - Fetching available currencies
 * - Getting/setting default currency
 * - User currency preferences
 * - Currency conversion
 * - Currency formatting
 */

export interface Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  exchange_rate: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCurrencyPreference {
  id: string;
  user_id: string;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Currency Queries
// =====================================================

/**
 * Get all active currencies
 */
export async function getCurrencies(): Promise<{ data: Currency[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("system_currencies")
      .select("*")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) {
      console.error("Error fetching currencies:", error);
      return { data: [], error: error.message };
    }

    return { data: data as Currency[] };
  } catch (error) {
    console.error("Unexpected error fetching currencies:", error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the default currency
 */
export async function getDefaultCurrency(): Promise<{ data: Currency | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("system_currencies")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error fetching default currency:", error);
      return { data: null, error: error.message };
    }

    return { data: data as Currency };
  } catch (error) {
    console.error("Unexpected error fetching default currency:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Set the default currency (admin only)
 */
export async function setDefaultCurrency(currencyCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc("set_default_currency", {
      p_currency_code: currencyCode,
    });

    if (error) {
      console.error("Error setting default currency:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error setting default currency:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's currency preference
 */
export async function getUserCurrencyPreference(
  userId: string
): Promise<{ data: UserCurrencyPreference | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("user_currency_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching user currency preference:", error);
      return { data: null, error: error.message };
    }

    return { data: data as UserCurrencyPreference | null };
  } catch (error) {
    console.error("Unexpected error fetching user currency preference:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Set user's currency preference
 */
export async function setUserCurrencyPreference(
  userId: string,
  currencyCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_currency_preferences")
      .upsert(
        {
          user_id: userId,
          currency_code: currencyCode,
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("Error setting user currency preference:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error setting user currency preference:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =====================================================
// Currency Conversion
// =====================================================

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ data: number | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("convert_currency", {
      p_amount: amount,
      p_from_currency: fromCurrency,
      p_to_currency: toCurrency,
    });

    if (error) {
      console.error("Error converting currency:", error);
      return { data: null, error: error.message };
    }

    return { data: data as number };
  } catch (error) {
    console.error("Unexpected error converting currency:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =====================================================
// Currency Formatting
// =====================================================

/**
 * Format amount with currency symbol
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    precision?: number;
  } = {}
): string {
  const {
    showSymbol = true,
    showCode = false,
    precision = 2,
  } = options;

  // Format the number with commas and decimal places
  const formattedAmount = amount.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  // Build the formatted string
  let result = "";
  
  if (showSymbol) {
    result = `${currency.symbol}${formattedAmount}`;
  } else {
    result = formattedAmount;
  }

  if (showCode) {
    result = `${result} ${currency.code}`;
  }

  return result;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned) || 0;
}

/**
 * Get currency by code
 */
export async function getCurrencyByCode(code: string): Promise<{ data: Currency | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("system_currencies")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error fetching currency by code:", error);
      return { data: null, error: error.message };
    }

    return { data: data as Currency };
  } catch (error) {
    console.error("Unexpected error fetching currency by code:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
