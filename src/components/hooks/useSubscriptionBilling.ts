import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { subscriptionBillingHandler } from '@/components/finance/SubscriptionBillingHandler';

/**
 * React Hook for Subscription Billing Management
 * 
 * Provides hooks for:
 * - Fetching billing cycles
 * - Creating and managing billing cycles
 * - Triggering manual billing
 * - Monitoring billing events
 * - Sending payment reminders
 * 
 * Requirements: 5.5, 5.6, 5.8, 5.10
 * Task: 14.3 Integrate with notification system
 */

// =====================================================
// TYPES
// =====================================================

export interface BillingCycle {
  id: string;
  vendor_id: string;
  cycle_type: 'monthly' | 'quarterly' | 'annual';
  cycle_day: number;
  base_amount: number;
  currency: string;
  is_active: boolean;
  last_billed_at: string | null;
  next_billing_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBillingCycleInput {
  vendor_id: string;
  cycle_type: 'monthly' | 'quarterly' | 'annual';
  cycle_day: number;
  base_amount: number;
  start_date?: string;
}

export interface BillingEvent {
  id: string;
  event_type: string;
  vendor_id: string;
  order_amount: number;
  currency: string;
  event_data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// =====================================================
// QUERY KEYS
// =====================================================

export const billingKeys = {
  all: ['billing'] as const,
  cycles: () => [...billingKeys.all, 'cycles'] as const,
  cycle: (id: string) => [...billingKeys.cycles(), id] as const,
  cycleByVendor: (vendorId: string) => [...billingKeys.cycles(), 'vendor', vendorId] as const,
  events: () => [...billingKeys.all, 'events'] as const,
  event: (id: string) => [...billingKeys.events(), id] as const,
  pendingEvents: () => [...billingKeys.events(), 'pending'] as const,
};

// =====================================================
// FETCH BILLING CYCLES
// =====================================================

async function fetchBillingCycles(): Promise<BillingCycle[]> {
  const { data, error } = await supabase
    .from('finance_billing_cycles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as BillingCycle[];
}

export function useBillingCycles() {
  return useQuery({
    queryKey: billingKeys.cycles(),
    queryFn: fetchBillingCycles,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =====================================================
// FETCH BILLING CYCLE BY VENDOR
// =====================================================

async function fetchBillingCycleByVendor(vendorId: string): Promise<BillingCycle | null> {
  const { data, error } = await supabase
    .from('finance_billing_cycles')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as BillingCycle | null;
}

export function useBillingCycleByVendor(vendorId: string) {
  return useQuery({
    queryKey: billingKeys.cycleByVendor(vendorId),
    queryFn: () => fetchBillingCycleByVendor(vendorId),
    enabled: !!vendorId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =====================================================
// CREATE BILLING CYCLE
// =====================================================

async function createBillingCycle(input: CreateBillingCycleInput): Promise<string> {
  const { data, error } = await supabase.rpc('initialize_billing_cycle', {
    p_vendor_id: input.vendor_id,
    p_cycle_type: input.cycle_type,
    p_cycle_day: input.cycle_day,
    p_base_amount: input.base_amount,
    p_start_date: input.start_date || new Date().toISOString().split('T')[0],
  });

  if (error) throw error;
  return data as string;
}

export function useCreateBillingCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBillingCycle,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.cycles() });
      queryClient.invalidateQueries({ queryKey: billingKeys.cycleByVendor(variables.vendor_id) });

      toast.success('Billing cycle created', {
        description: `${variables.cycle_type} billing cycle initialized`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create billing cycle', {
        description: error.message,
      });
    },
  });
}

// =====================================================
// DEACTIVATE BILLING CYCLE
// =====================================================

async function deactivateBillingCycle(vendorId: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_billing_cycle', {
    p_vendor_id: vendorId,
  });

  if (error) throw error;
}

export function useDeactivateBillingCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateBillingCycle,
    onSuccess: (_, vendorId) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.cycles() });
      queryClient.invalidateQueries({ queryKey: billingKeys.cycleByVendor(vendorId) });

      toast.success('Billing cycle deactivated');
    },
    onError: (error: Error) => {
      toast.error('Failed to deactivate billing cycle', {
        description: error.message,
      });
    },
  });
}

// =====================================================
// TRIGGER MANUAL BILLING
// =====================================================

async function triggerManualBilling(vendorId: string, amount: number) {
  return await subscriptionBillingHandler.triggerManualBilling(vendorId, amount);
}

export function useTriggerManualBilling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, amount }: { vendorId: string; amount: number }) =>
      triggerManualBilling(vendorId, amount),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: billingKeys.events() });

        toast.success('Manual billing triggered', {
          description: `Invoice ${result.invoice_number} generated for ₨${result.amount?.toLocaleString()}`,
        });
      } else {
        toast.error('Manual billing failed', {
          description: result.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to trigger manual billing', {
        description: error.message,
      });
    },
  });
}

// =====================================================
// FETCH BILLING EVENTS
// =====================================================

async function fetchBillingEvents(): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from('finance_revenue_events')
    .select('*')
    .in('event_type', ['subscription_threshold_reached', 'subscription_cycle_due'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data as BillingEvent[];
}

export function useBillingEvents() {
  return useQuery({
    queryKey: billingKeys.events(),
    queryFn: fetchBillingEvents,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// =====================================================
// FETCH PENDING BILLING EVENTS
// =====================================================

async function fetchPendingBillingEvents(): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from('finance_revenue_events')
    .select('*')
    .in('event_type', ['subscription_threshold_reached', 'subscription_cycle_due'])
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as BillingEvent[];
}

export function usePendingBillingEvents() {
  return useQuery({
    queryKey: billingKeys.pendingEvents(),
    queryFn: fetchPendingBillingEvents,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

// =====================================================
// TRIGGER BILLING CYCLE PROCESSING
// =====================================================

async function triggerBillingCycleProcessing() {
  const { data, error } = await supabase.rpc('trigger_billing_cycle_processing');

  if (error) throw error;
  return data;
}

export function useTriggerBillingCycleProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerBillingCycleProcessing,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.events() });
      queryClient.invalidateQueries({ queryKey: billingKeys.cycles() });

      toast.success('Billing cycle processing triggered', {
        description: `${result.success_count} cycles processed, ${result.failure_count} failed`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to trigger billing cycle processing', {
        description: error.message,
      });
    },
  });
}

// =====================================================
// SEND PAYMENT REMINDERS
// =====================================================

async function sendPaymentReminders() {
  await subscriptionBillingHandler.sendPaymentReminders();
  return { success: true };
}

export function useSendPaymentReminders() {
  return useMutation({
    mutationFn: sendPaymentReminders,
    onSuccess: () => {
      toast.success('Payment reminders sent', {
        description: 'Reminders sent for all overdue invoices',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to send payment reminders', {
        description: error.message,
      });
    },
  });
}
