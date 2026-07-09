import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VendorPayment {
  id: string;
  vendor_id: string;
  order_id: string;
  order_amount: number;
  commission_amount: number;
  upfront_amount: number;
  upfront_percentage: number;
  upfront_paid_at: string | null;
  remaining_amount: number;
  remaining_released_at: string | null;
  payment_status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  vendor_id: string;
  order_id: string;
  order_amount: number;
  commission_amount?: number;
  upfront_amount?: number;
  upfront_percentage?: number;
  upfront_paid_at?: string;
  remaining_amount?: number;
  remaining_released_at?: string;
  payment_status?: string;
  notes?: string;
}

export function useVendorPayments(vendorId?: string) {
  return useQuery({
    queryKey: vendorId ? ["vendor-payments", vendorId] : ["all-payments"],
    queryFn: async () => {
      let query = supabase
        .from("vendor_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as VendorPayment[];
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase
        .from("vendor_payments")
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-payments", data.vendor_id] });
      toast.success("Payment record created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create payment: ${error.message}`);
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<VendorPayment> & { id: string }) => {
      const { data, error } = await supabase
        .from("vendor_payments")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-payments", data.vendor_id] });
      toast.success("Payment updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update payment: ${error.message}`);
    },
  });
}

export function usePaymentStats(vendorId: string) {
  return useQuery({
    queryKey: ["vendor-payment-stats", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_payments")
        .select("*")
        .eq("vendor_id", vendorId);

      if (error) throw error;

      const payments = data as VendorPayment[];
      const totalOrders = payments.length;
      const totalOrderAmount = payments.reduce((sum, p) => sum + (p.order_amount || 0), 0);
      const totalCommission = payments.reduce((sum, p) => sum + (p.commission_amount || 0), 0);
      const totalUpfront = payments.reduce((sum, p) => sum + (p.upfront_amount || 0), 0);
      const totalReleased = payments
        .filter(p => p.remaining_released_at)
        .reduce((sum, p) => sum + (p.remaining_amount || 0), 0);
      const pendingPayments = payments.filter(p => p.payment_status === 'pending').length;
      const completedPayments = payments.filter(p => p.payment_status === 'completed').length;

      return {
        totalOrders,
        totalOrderAmount,
        totalCommission,
        totalUpfront,
        totalReleased,
        pendingPayments,
        completedPayments,
        totalEarned: totalOrderAmount - totalCommission,
      };
    },
    enabled: !!vendorId,
  });
}

export function useVendorRevenueTrend(vendorId: string) {
  return useQuery({
    queryKey: ["vendor-revenue-trend", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_payments")
        .select("order_amount, commission_amount, created_at")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const payments = data as any[];
      const months: Record<string, { revenue: number, orders: number }> = {};

      // Initialize last 6 months
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months[monthKey] = { revenue: 0, orders: 0 };
      }

      payments.forEach(p => {
        const d = new Date(p.created_at);
        const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (months[monthKey] !== undefined) {
          months[monthKey].revenue += (Number(p.order_amount) || 0) - (Number(p.commission_amount) || 0);
          months[monthKey].orders += 1;
        }
      });

      return Object.entries(months).map(([name, stats]) => ({
        name,
        revenue: stats.revenue,
        orders: stats.orders
      }));
    },
    enabled: !!vendorId,
  });
}
