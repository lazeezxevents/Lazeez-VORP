import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { accountsPayableService } from "./AccountsPayableService";

/**
 * Custom hook for vendor payout management
 * Task 17.3: Implement vendor payout processing UI
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

// =====================================================
// Types
// =====================================================

export interface VendorPayout {
  id: string;
  vendor_id: string;
  vendor_name: string;
  order_id: string;
  order_number: string;
  order_amount: number;
  upfront_amount: number;
  upfront_percentage: number;
  remaining_amount: number;
  commission_amount: number;
  commission_rate: number;
  net_payout: number;
  payout_status: 'pending' | 'processing' | 'completed' | 'failed';
  upfront_paid: boolean;
  upfront_paid_at: string | null;
  remaining_paid: boolean;
  remaining_paid_at: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutSummary {
  total_pending: number;
  total_processing: number;
  total_completed_today: number;
  pending_count: number;
  processing_count: number;
}

export interface ProcessPayoutInput {
  vendor_id: string;
  order_id: string;
}

// =====================================================
// Query Keys
// =====================================================

const payoutKeys = {
  all: ["vendor-payouts"] as const,
  lists: () => [...payoutKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...payoutKeys.lists(), filters] as const,
  details: () => [...payoutKeys.all, "detail"] as const,
  detail: (id: string) => [...payoutKeys.details(), id] as const,
  summary: () => [...payoutKeys.all, "summary"] as const,
  history: (vendorId: string) => [...payoutKeys.all, "history", vendorId] as const,
};

// =====================================================
// Fetch Functions
// =====================================================

async function fetchPendingPayouts(): Promise<VendorPayout[]> {
  const { data, error } = await supabase
    .from("finance_order_data")
    .select(`
      *,
      vendor:vendors(id, name)
    `)
    .eq("payout_status", "pending")
    .eq("remaining_paid", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending payouts:", error);
    throw new Error(error.message);
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    vendor_id: item.vendor_id,
    vendor_name: item.vendor?.name || "Unknown",
    order_id: item.order_id,
    order_number: item.order_number,
    order_amount: item.order_amount,
    upfront_amount: item.upfront_amount,
    upfront_percentage: item.upfront_percentage,
    remaining_amount: item.remaining_amount,
    commission_amount: item.commission_amount,
    commission_rate: item.commission_rate,
    net_payout: item.net_payout,
    payout_status: item.payout_status,
    upfront_paid: item.upfront_paid,
    upfront_paid_at: item.upfront_paid_at,
    remaining_paid: item.remaining_paid,
    remaining_paid_at: item.remaining_paid_at,
    payment_method: null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

async function fetchPayoutHistory(vendorId?: string): Promise<VendorPayout[]> {
  let query = supabase
    .from("finance_order_data")
    .select(`
      *,
      vendor:vendors(id, name)
    `)
    .eq("payout_status", "completed")
    .order("remaining_paid_at", { ascending: false });

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching payout history:", error);
    throw new Error(error.message);
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    vendor_id: item.vendor_id,
    vendor_name: item.vendor?.name || "Unknown",
    order_id: item.order_id,
    order_number: item.order_number,
    order_amount: item.order_amount,
    upfront_amount: item.upfront_amount,
    upfront_percentage: item.upfront_percentage,
    remaining_amount: item.remaining_amount,
    commission_amount: item.commission_amount,
    commission_rate: item.commission_rate,
    net_payout: item.net_payout,
    payout_status: item.payout_status,
    upfront_paid: item.upfront_paid,
    upfront_paid_at: item.upfront_paid_at,
    remaining_paid: item.remaining_paid,
    remaining_paid_at: item.remaining_paid_at,
    payment_method: null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

async function fetchPayoutSummary(): Promise<PayoutSummary> {
  // Fetch pending payouts
  const { data: pendingData, error: pendingError } = await supabase
    .from("finance_order_data")
    .select("net_payout")
    .eq("payout_status", "pending")
    .eq("remaining_paid", false);

  if (pendingError) {
    console.error("Error fetching pending summary:", pendingError);
    throw new Error(pendingError.message);
  }

  // Fetch processing payouts
  const { data: processingData, error: processingError } = await supabase
    .from("finance_order_data")
    .select("net_payout")
    .eq("payout_status", "processing");

  if (processingError) {
    console.error("Error fetching processing summary:", processingError);
    throw new Error(processingError.message);
  }

  // Fetch completed today
  const today = new Date().toISOString().split("T")[0];
  const { data: completedData, error: completedError } = await supabase
    .from("finance_order_data")
    .select("net_payout")
    .eq("payout_status", "completed")
    .gte("remaining_paid_at", today);

  if (completedError) {
    console.error("Error fetching completed summary:", completedError);
    throw new Error(completedError.message);
  }

  return {
    total_pending: (pendingData || []).reduce((sum, item) => sum + (item.net_payout || 0), 0),
    total_processing: (processingData || []).reduce((sum, item) => sum + (item.net_payout || 0), 0),
    total_completed_today: (completedData || []).reduce((sum, item) => sum + (item.net_payout || 0), 0),
    pending_count: (pendingData || []).length,
    processing_count: (processingData || []).length,
  };
}

async function fetchPayoutDetail(orderId: string): Promise<VendorPayout | null> {
  const { data, error } = await supabase
    .from("finance_order_data")
    .select(`
      *,
      vendor:vendors(id, name)
    `)
    .eq("order_id", orderId)
    .single();

  if (error) {
    console.error("Error fetching payout detail:", error);
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    vendor_id: data.vendor_id,
    vendor_name: data.vendor?.name || "Unknown",
    order_id: data.order_id,
    order_number: data.order_number,
    order_amount: data.order_amount,
    upfront_amount: data.upfront_amount,
    upfront_percentage: data.upfront_percentage,
    remaining_amount: data.remaining_amount,
    commission_amount: data.commission_amount,
    commission_rate: data.commission_rate,
    net_payout: data.net_payout,
    payout_status: data.payout_status,
    upfront_paid: data.upfront_paid,
    upfront_paid_at: data.upfront_paid_at,
    remaining_paid: data.remaining_paid,
    remaining_paid_at: data.remaining_paid_at,
    payment_method: null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// =====================================================
// Hooks
// =====================================================

/**
 * Hook to fetch pending payouts
 */
export function usePendingPayouts() {
  return useQuery({
    queryKey: payoutKeys.list({ status: "pending" }),
    queryFn: fetchPendingPayouts,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to fetch payout history
 */
export function usePayoutHistory(vendorId?: string) {
  return useQuery({
    queryKey: payoutKeys.history(vendorId || "all"),
    queryFn: () => fetchPayoutHistory(vendorId),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch payout summary
 */
export function usePayoutSummary() {
  return useQuery({
    queryKey: payoutKeys.summary(),
    queryFn: fetchPayoutSummary,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to fetch payout detail
 */
export function usePayoutDetail(orderId: string) {
  return useQuery({
    queryKey: payoutKeys.detail(orderId),
    queryFn: () => fetchPayoutDetail(orderId),
    enabled: !!orderId,
    staleTime: 30000,
  });
}

/**
 * Hook to process vendor payout
 * Requirement 6.1-6.5: Process vendor payout with commission deductions
 */
export function useProcessPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProcessPayoutInput) => {
      const result = await accountsPayableService.processVendorPayout(
        input.vendor_id,
        input.order_id
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to process payout");
      }

      return result.payout;
    },
    onSuccess: () => {
      // Invalidate all payout queries
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.summary() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.all });
      toast.success("Payout processed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to process payout: ${error.message}`);
    },
  });
}

/**
 * Hook to subscribe to payout updates
 */
export function usePayoutSubscription() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["payout-subscription"],
    queryFn: () => {
      const channel = supabase
        .channel("payout-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "finance_order_data",
          },
          (payload) => {
            // Invalidate queries to refetch updated data
            queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
            queryClient.invalidateQueries({ queryKey: payoutKeys.summary() });
          }
        )
        .subscribe();

      return channel;
    },
    staleTime: Infinity,
  });
}
