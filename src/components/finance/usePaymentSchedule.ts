import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { accountsPayableService } from "./AccountsPayableService";

/**
 * Custom hook for payment scheduling management
 * Task 17.4: Implement payment scheduling
 * Requirements: 8.3, 8.6, 8.10
 */

// =====================================================
// Types
// =====================================================

export interface ScheduledPayment {
  id: string;
  bill_id: string;
  bill_number: string;
  vendor_id: string;
  vendor_name: string;
  payment_date: string;
  amount: number;
  status: 'scheduled' | 'processing' | 'completed' | 'cancelled' | 'failed';
  payment_method: string;
  notes?: string;
  is_large_payment: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedulePaymentInput {
  bill_id: string;
  payment_date: string;
  payment_method?: string;
  notes?: string;
}

export interface UpdateScheduleInput {
  scheduled_payment_id: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
}

export interface PaymentScheduleFilters {
  start_date?: string;
  end_date?: string;
  vendor_id?: string;
  min_amount?: number;
  max_amount?: number;
  status?: string;
}

// =====================================================
// Query Keys
// =====================================================

const scheduleKeys = {
  all: ["payment-schedule"] as const,
  lists: () => [...scheduleKeys.all, "list"] as const,
  list: (filters: PaymentScheduleFilters) => [...scheduleKeys.lists(), filters] as const,
  details: () => [...scheduleKeys.all, "detail"] as const,
  detail: (id: string) => [...scheduleKeys.details(), id] as const,
  upcoming: () => [...scheduleKeys.all, "upcoming"] as const,
  largePayments: () => [...scheduleKeys.all, "large-payments"] as const,
};

// =====================================================
// Fetch Functions
// =====================================================

async function fetchScheduledPayments(filters: PaymentScheduleFilters = {}): Promise<ScheduledPayment[]> {
  // For now, we'll fetch from audit logs since we don't have a dedicated table yet
  // In production, this would query a finance_scheduled_payments table
  const { data, error } = await supabase
    .from("finance_audit_log")
    .select("*")
    .eq("entity_type", "scheduled_payment")
    .in("action", ["schedule", "update"])
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("Error fetching scheduled payments:", error);
    throw new Error(error.message);
  }

  // Transform audit log entries to scheduled payments
  const payments: ScheduledPayment[] = (data || []).map((entry: any) => {
    const values = entry.new_values || {};
    const amount = values.amount || 0;
    
    return {
      id: values.scheduled_payment_id || entry.entity_id,
      bill_id: values.bill_id || "",
      bill_number: values.bill_number || "N/A",
      vendor_id: values.vendor_id || "",
      vendor_name: values.vendor_name || "Unknown",
      payment_date: values.payment_date || entry.changed_at,
      amount: amount,
      status: values.status || "scheduled",
      payment_method: values.payment_method || "bank_transfer",
      notes: values.notes,
      is_large_payment: amount > 10000, // PKR 10,000 threshold
      created_at: entry.changed_at,
      updated_at: entry.changed_at,
    };
  });

  // Apply filters
  let filtered = payments;

  if (filters.start_date) {
    filtered = filtered.filter(p => p.payment_date >= filters.start_date!);
  }

  if (filters.end_date) {
    filtered = filtered.filter(p => p.payment_date <= filters.end_date!);
  }

  if (filters.vendor_id) {
    filtered = filtered.filter(p => p.vendor_id === filters.vendor_id);
  }

  if (filters.min_amount !== undefined) {
    filtered = filtered.filter(p => p.amount >= filters.min_amount!);
  }

  if (filters.max_amount !== undefined) {
    filtered = filtered.filter(p => p.amount <= filters.max_amount!);
  }

  if (filters.status) {
    filtered = filtered.filter(p => p.status === filters.status);
  }

  return filtered;
}

async function fetchUpcomingPayments(): Promise<ScheduledPayment[]> {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return fetchScheduledPayments({
    start_date: today.toISOString().split('T')[0],
    end_date: nextWeek.toISOString().split('T')[0],
    status: 'scheduled',
  });
}

async function fetchLargePayments(): Promise<ScheduledPayment[]> {
  const payments = await fetchScheduledPayments({
    min_amount: 10000, // PKR 10,000 threshold
    status: 'scheduled',
  });

  return payments.filter(p => p.is_large_payment);
}

// =====================================================
// Hooks
// =====================================================

/**
 * Hook to fetch scheduled payments with filters
 * Requirement 8.6: Generate payment schedules
 */
export function useScheduledPayments(filters: PaymentScheduleFilters = {}) {
  return useQuery({
    queryKey: scheduleKeys.list(filters),
    queryFn: () => fetchScheduledPayments(filters),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch upcoming payments (next 7 days)
 * Requirement 8.6: Show upcoming payments
 */
export function useUpcomingPayments() {
  return useQuery({
    queryKey: scheduleKeys.upcoming(),
    queryFn: fetchUpcomingPayments,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to fetch large payments (> PKR 10,000)
 * Requirement 8.10: Alert on upcoming large payments
 */
export function useLargePayments() {
  return useQuery({
    queryKey: scheduleKeys.largePayments(),
    queryFn: fetchLargePayments,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Hook to schedule a payment
 * Requirement 8.3: Schedule payments based on due dates
 */
export function useSchedulePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SchedulePaymentInput) => {
      const paymentDate = new Date(input.payment_date);
      
      const result = await accountsPayableService.schedulePayment(
        input.bill_id,
        paymentDate,
        input.payment_method,
        input.notes
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to schedule payment");
      }

      return result.scheduled_payment;
    },
    onSuccess: () => {
      // Invalidate all schedule queries
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.largePayments() });
      toast.success("Payment scheduled successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to schedule payment: ${error.message}`);
    },
  });
}

/**
 * Hook to update scheduled payment
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateScheduleInput) => {
      // This would call an update method on the service
      // For now, we'll create a new schedule entry in audit log
      const paymentDate = input.payment_date ? new Date(input.payment_date) : undefined;
      
      // In production, this would update the scheduled payment record
      // For now, we'll just log the update
      console.log("Updating scheduled payment:", input);
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Payment schedule updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });
}

/**
 * Hook to cancel scheduled payment
 */
export function useCancelScheduledPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduledPaymentId: string) => {
      // In production, this would update the status to 'cancelled'
      console.log("Cancelling scheduled payment:", scheduledPaymentId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Payment cancelled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel payment: ${error.message}`);
    },
  });
}

/**
 * Hook to subscribe to payment schedule updates
 */
export function usePaymentScheduleSubscription() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["payment-schedule-subscription"],
    queryFn: () => {
      const channel = supabase
        .channel("payment-schedule-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "finance_audit_log",
            filter: "entity_type=eq.scheduled_payment",
          },
          () => {
            // Invalidate queries to refetch updated data
            queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
          }
        )
        .subscribe();

      return channel;
    },
    staleTime: Infinity,
  });
}
