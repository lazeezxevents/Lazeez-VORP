import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBusinessInsights() {
  return useQuery({
    queryKey: ["analytics", "business-insights"],
    queryFn: async () => {
      // Get vendor data
      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, status, commission_percentage");
      
      if (vendorsError) throw vendorsError;

      // Get vendor payments data
      const { data: payments, error: paymentsError } = await supabase
        .from("vendor_payments")
        .select("amount, payment_type, payment_date");
      
      if (paymentsError) throw paymentsError;

      // Get finance vendor profiles for commission data
      const { data: financeProfiles, error: financeError } = await supabase
        .from("finance_vendor_profiles")
        .select("total_revenue_ytd, total_commission_paid");
      
      // Calculate metrics
      const totalVendors = vendors?.length || 0;
      const registeredVendors = vendors?.filter(v => v.status !== "pending").length || 0;
      
      // Count total orders (from payments if available)
      const totalOrders = payments?.length || 0;
      
      // Calculate total revenue from payments
      const totalRevenue = payments?.reduce((sum, p) => {
        return sum + (Number(p.amount) || 0);
      }, 0) || 0;
      
      // Format revenue in PKR
      const revenueFormatted = totalRevenue > 0 
        ? `PKR ${(totalRevenue / 1000000).toFixed(1)}M`
        : "PKR 0";

      // Pending vendor approvals
      const pendingVendorApprovals = vendors?.filter(v => v.status === "pending").length || 0;

      // Vendor retention rate (active vendors in last 30 days)
      // For now, use active status as proxy
      const activeVendors = vendors?.filter(v => v.status === "active").length || 0;
      const retentionRate = totalVendors > 0 
        ? Math.round((activeVendors / totalVendors) * 100)
        : 0;

      // Calculate commission earned (14% of revenue as default)
      const commissionEarned = financeProfiles?.reduce((sum, p) => {
        return sum + (Number(p.total_commission_paid) || 0);
      }, 0) || (totalRevenue * 0.14); // Fallback to 14% if no finance data
      
      const commissionFormatted = commissionEarned > 0
        ? `PKR ${Math.round(commissionEarned).toLocaleString()}`
        : "PKR 0";

      return {
        totalVendors: registeredVendors,
        totalOrders,
        totalRevenue: revenueFormatted,
        pendingVendorApprovals,
        vendorRetention: `${retentionRate}%`,
        commissionEarned: commissionFormatted,
      };
    },
  });
}
