// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRateProvider {
  name: string;
  fetchRates: (baseCurrency: string) => Promise<Record<string, number>>;
}

// =====================================================
// Exchange Rate Providers
// =====================================================

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

const PROVIDERS: ExchangeRateProvider[] = [
  exchangeRateApiProvider,
  frankfurterProvider,
];

// =====================================================
// Main Handler
// =====================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const baseCurrency = "PKR"; // Base currency for the system
    const errors: string[] = [];
    let rates: Record<string, number> = {};
    let source = "none";

    // Try each provider with fallback
    for (const provider of PROVIDERS) {
      try {
        console.log(`Attempting to fetch rates from ${provider.name}...`);
        rates = await provider.fetchRates(baseCurrency);

        if (!rates || Object.keys(rates).length === 0) {
          throw new Error("No rates returned");
        }

        source = provider.name;
        console.log(`Successfully fetched rates from ${provider.name}`);
        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`${provider.name} failed:`, errorMsg);
        errors.push(`${provider.name}: ${errorMsg}`);
      }
    }

    // Check if we got rates
    if (Object.keys(rates).length === 0) {
      throw new Error(`All providers failed: ${errors.join("; ")}`);
    }

    // Prepare rate records
    const date = new Date().toISOString().split("T")[0];
    const rateRecords = Object.entries(rates).map(([toCurrency, rate]) => ({
      from_currency: baseCurrency,
      to_currency: toCurrency,
      rate,
      rate_date: date,
      source,
    }));

    // Also add inverse rates
    const inverseRecords = Object.entries(rates).map(([toCurrency, rate]) => ({
      from_currency: toCurrency,
      to_currency: baseCurrency,
      rate: 1 / rate,
      rate_date: date,
      source,
    }));

    const allRecords = [...rateRecords, ...inverseRecords];

    // Store in database
    const { error: dbError, count } = await supabaseClient
      .from("finance_exchange_rates")
      .upsert(allRecords, {
        onConflict: "from_currency,to_currency,rate_date",
        ignoreDuplicates: false,
      });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`Successfully stored ${count || allRecords.length} exchange rates`);

    return new Response(
      JSON.stringify({
        success: true,
        source,
        count: count || allRecords.length,
        date,
        message: `Successfully updated exchange rates from ${source}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in fetch-exchange-rates function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
