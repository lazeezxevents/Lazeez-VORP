import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateDailyExchangeRates,
  getExchangeRate,
  getLatestExchangeRate,
  getHistoricalRates,
  type ExchangeRate,
} from "./ExchangeRateService";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook for managing exchange rates
 */
export function useExchangeRates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation for updating daily rates
  const updateRatesMutation = useMutation({
    mutationFn: (baseCurrency?: string) => updateDailyExchangeRates(baseCurrency),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Exchange rates updated",
          description: `Successfully updated ${data.count} rates from ${data.source}`,
        });
        queryClient.invalidateQueries({ queryKey: ["exchangeRates"] });
      } else {
        toast({
          title: "Failed to update rates",
          description: data.error,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error updating rates",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    updateRates: updateRatesMutation.mutate,
    isUpdating: updateRatesMutation.isPending,
  };
}

/**
 * Hook for fetching a specific exchange rate
 */
export function useExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
) {
  return useQuery({
    queryKey: ["exchangeRate", fromCurrency, toCurrency, date?.toISOString()],
    queryFn: async () => {
      const { data, error } = await getExchangeRate(fromCurrency, toCurrency, date);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!fromCurrency && !!toCurrency,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for fetching the latest exchange rate
 */
export function useLatestExchangeRate(fromCurrency: string, toCurrency: string) {
  return useQuery({
    queryKey: ["latestExchangeRate", fromCurrency, toCurrency],
    queryFn: async () => {
      const { data, error } = await getLatestExchangeRate(fromCurrency, toCurrency);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!fromCurrency && !!toCurrency,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for fetching historical exchange rates
 */
export function useHistoricalRates(
  fromCurrency: string,
  toCurrency: string,
  startDate: Date,
  endDate: Date
) {
  return useQuery({
    queryKey: [
      "historicalRates",
      fromCurrency,
      toCurrency,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      const { data, error } = await getHistoricalRates(
        fromCurrency,
        toCurrency,
        startDate,
        endDate
      );
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!fromCurrency && !!toCurrency && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Hook for currency conversion with real-time rates
 */
export function useCurrencyConverter() {
  const [amount, setAmount] = useState<number>(0);
  const [fromCurrency, setFromCurrency] = useState<string>("PKR");
  const [toCurrency, setToCurrency] = useState<string>("USD");
  const [convertedAmount, setConvertedAmount] = useState<number>(0);

  const { data: rate, isLoading } = useLatestExchangeRate(fromCurrency, toCurrency);

  useEffect(() => {
    if (rate && amount > 0) {
      setConvertedAmount(amount * rate.rate);
    } else {
      setConvertedAmount(0);
    }
  }, [rate, amount]);

  return {
    amount,
    setAmount,
    fromCurrency,
    setFromCurrency,
    toCurrency,
    setToCurrency,
    convertedAmount,
    rate: rate?.rate,
    isLoading,
  };
}
