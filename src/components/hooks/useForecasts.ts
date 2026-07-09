import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ForecastingEngine } from "@/services/ForecastingEngine";
import { toast } from "sonner";

export interface Forecast {
  id: string;
  type: "revenue" | "expense" | "cash_flow" | "commission";
  method: "linear" | "seasonal" | "ml" | "exponential";
  baseline_data: any;
  predictions: Record<string, number>;
  confidence_intervals: Record<string, { lower: number; upper: number }>;
  trend_direction: "increasing" | "decreasing" | "stable";
  growth_rate: number;
  seasonality_detected: boolean;
  seasonality_pattern?: any;
  recommendations: string[];
  created_by: string;
  created_at: string;
  forecast_period_start: string;
  forecast_period_end: string;
}

/**
 * Fetch all forecasts
 */
export function useForecasts(type?: Forecast["type"]) {
  return useQuery({
    queryKey: ["forecasts", type],
    queryFn: async () => {
      let query = supabase
        .from("finance_forecasts")
        .select("*")
        .order("created_at", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Forecast[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch a single forecast
 */
export function useForecast(forecastId: string) {
  return useQuery({
    queryKey: ["forecasts", forecastId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_forecasts")
        .select("*")
        .eq("id", forecastId)
        .single();

      if (error) throw error;
      return data as Forecast;
    },
    enabled: !!forecastId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Generate revenue forecast
 */
export function useGenerateRevenueForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      months = 6,
      method = "seasonal",
    }: {
      months?: number;
      method?: "linear" | "seasonal" | "ml";
    }) => {
      return await ForecastingEngine.forecastRevenue(months, method);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      toast.success("Forecast generated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate forecast: ${error.message}`);
    },
  });
}

/**
 * Track forecast accuracy
 */
export function useTrackForecastAccuracy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      forecastId,
      periodDate,
      actualValue,
    }: {
      forecastId: string;
      periodDate: Date;
      actualValue: number;
    }) => {
      return await ForecastingEngine.trackAccuracy(forecastId, periodDate, actualValue);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forecasts", variables.forecastId] });
      queryClient.invalidateQueries({ queryKey: ["forecast-accuracy", variables.forecastId] });
      toast.success("Forecast accuracy tracked");
    },
    onError: (error: Error) => {
      toast.error(`Failed to track accuracy: ${error.message}`);
    },
  });
}

/**
 * Get forecast accuracy data
 */
export function useForecastAccuracy(forecastId: string) {
  return useQuery({
    queryKey: ["forecast-accuracy", forecastId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_forecast_accuracy")
        .select("*")
        .eq("forecast_id", forecastId)
        .order("period_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!forecastId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Get latest forecast by type
 */
export function useLatestForecast(type: Forecast["type"]) {
  return useQuery({
    queryKey: ["forecasts", "latest", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_forecasts")
        .select("*")
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as Forecast;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Delete a forecast
 */
export function useDeleteForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (forecastId: string) => {
      const { error } = await supabase.from("finance_forecasts").delete().eq("id", forecastId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      toast.success("Forecast deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete forecast: ${error.message}`);
    },
  });
}
