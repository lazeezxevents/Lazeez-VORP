import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionManagerService } from "@/components/finance/SubscriptionManagerService";
import { processSubscriptionThresholdEvent } from "@/components/finance/SubscriptionEventProcessor";
import type { 
  SubscriptionPlan, 
  ThresholdStatus,
  ProratedAmount 
} from "@/components/finance/types";
import { toast } from "sonner";

/**
 * Hook for managing vendor subscriptions
 * 
 * Provides queries and mutations for:
 * - Checking vendor threshold status
 * - Creating subscriptions
 * - Generating invoices
 * - Calculating proration
 */

// =====================================================
// Queries
// =====================================================

/**
 * Fetch vendor threshold status
 */
export function useVendorThreshold(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-threshold", vendorId],
    queryFn: async (): Promise<ThresholdStatus | null> => {
      if (!vendorId) return null;

      const result = await subscriptionManagerService.checkThreshold(vendorId);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch threshold status");
      }

      return result.thresholdStatus || null;
    },
    enabled: !!vendorId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch pending subscription events
 */
export function usePendingSubscriptionEvents() {
  return useQuery({
    queryKey: ["pending-subscription-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_revenue_events")
        .select("*")
        .eq("event_type", "subscription_threshold_reached")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Fetch vendor financial profile
 */
export function useVendorFinancialProfile(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-financial-profile", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;

      const { data, error } = await supabase
        .from("finance_vendor_profiles")
        .select("*")
        .eq("vendor_id", vendorId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!vendorId,
  });
}

// =====================================================
// Mutations
// =====================================================

/**
 * Create a new subscription for a vendor
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      plan,
    }: {
      vendorId: string;
      plan: SubscriptionPlan;
    }) => {
      const result = await subscriptionManagerService.createSubscription(
        vendorId,
        plan
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to create subscription");
      }

      return result.subscription;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-threshold", variables.vendorId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-financial-profile", variables.vendorId] 
      });
      toast.success("Subscription created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create subscription: ${error.message}`);
    },
  });
}

/**
 * Generate invoice for vendor subscription
 */
export function useGenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      amount,
    }: {
      vendorId: string;
      amount: number;
    }) => {
      const result = await subscriptionManagerService.generateInvoice(
        vendorId,
        amount
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to generate invoice");
      }

      return result.invoice;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-threshold", variables.vendorId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-financial-profile", variables.vendorId] 
      });
      toast.success("Invoice generated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate invoice: ${error.message}`);
    },
  });
}

/**
 * Calculate prorated billing amount
 */
export function useCalculateProration() {
  return useMutation({
    mutationFn: async ({
      vendorId,
      newAmount,
      changeDate,
    }: {
      vendorId: string;
      newAmount: number;
      changeDate: Date;
    }): Promise<ProratedAmount> => {
      const result = await subscriptionManagerService.prorateBilling(
        vendorId,
        newAmount,
        changeDate
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to calculate proration");
      }

      return result.proratedAmount!;
    },
    onError: (error: Error) => {
      toast.error(`Failed to calculate proration: ${error.message}`);
    },
  });
}

/**
 * Process a subscription threshold event
 */
export function useProcessSubscriptionEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const result = await processSubscriptionThresholdEvent(eventId);

      if (!result.success) {
        throw new Error(result.error || "Failed to process subscription event");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["pending-subscription-events"] 
      });
      toast.success("Subscription event processed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to process event: ${error.message}`);
    },
  });
}

/**
 * Update vendor threshold limit
 */
export function useUpdateThresholdLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      thresholdLimit,
    }: {
      vendorId: string;
      thresholdLimit: number;
    }) => {
      const { data, error } = await supabase
        .from("finance_vendor_profiles")
        .update({ threshold_limit: thresholdLimit })
        .eq("vendor_id", vendorId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-threshold", variables.vendorId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-financial-profile", variables.vendorId] 
      });
      toast.success("Threshold limit updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update threshold: ${error.message}`);
    },
  });
}

/**
 * Reset vendor threshold counter manually
 */
export function useResetThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { data, error } = await supabase
        .from("finance_vendor_profiles")
        .update({ current_threshold: 0 })
        .eq("vendor_id", vendorId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vendorId) => {
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-threshold", vendorId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["vendor-financial-profile", vendorId] 
      });
      toast.success("Threshold counter reset successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset threshold: ${error.message}`);
    },
  });
}
