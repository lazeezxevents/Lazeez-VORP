import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAnalytics() {
  const vendorStats = useQuery({
    queryKey: ["analytics", "vendors"],
    queryFn: async () => {
      const { data: vendors, error } = await supabase
        .from("vendors")
        .select("id, name, status, category, rating, created_at");
      
      if (error) throw error;
      
      const totalVendors = vendors?.length || 0;
      const activeVendors = vendors?.filter(v => v.status === "active").length || 0;
      const pendingVendors = vendors?.filter(v => v.status === "pending").length || 0;
      
      const categoryDistribution = vendors?.reduce((acc, v) => {
        acc[v.category] = (acc[v.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const avgRating = vendors?.filter(v => v.rating).reduce((sum, v) => sum + (v.rating || 0), 0) / 
        (vendors?.filter(v => v.rating).length || 1);
      
      return {
        totalVendors,
        activeVendors,
        pendingVendors,
        categoryDistribution,
        avgRating: avgRating || 0,
        vendors: vendors || []
      };
    }
  });

  const issueStats = useQuery({
    queryKey: ["analytics", "issues"],
    queryFn: async () => {
      const { data: issues, error } = await supabase
        .from("issues")
        .select("id, status, priority, created_at, resolved_at, vendor_id");
      
      if (error) throw error;
      
      const totalIssues = issues?.length || 0;
      const openIssues = issues?.filter(i => i.status === "open").length || 0;
      const inProgressIssues = issues?.filter(i => i.status === "in_progress").length || 0;
      const resolvedIssues = issues?.filter(i => i.status === "resolved" || i.status === "closed").length || 0;
      
      const priorityDistribution = issues?.reduce((acc, i) => {
        acc[i.priority] = (acc[i.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const statusDistribution = issues?.reduce((acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      // Calculate average resolution time (in hours)
      const resolvedWithTime = issues?.filter(i => i.resolved_at) || [];
      const avgResolutionTime = resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, i) => {
            const created = new Date(i.created_at).getTime();
            const resolved = new Date(i.resolved_at!).getTime();
            return sum + (resolved - created) / (1000 * 60 * 60);
          }, 0) / resolvedWithTime.length
        : 0;
      
      // Group issues by month for trends
      const monthlyTrends = issues?.reduce((acc, i) => {
        const month = new Date(i.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      return {
        totalIssues,
        openIssues,
        inProgressIssues,
        resolvedIssues,
        priorityDistribution,
        statusDistribution,
        avgResolutionTime,
        monthlyTrends,
        issues: issues || []
      };
    }
  });

  const mouStats = useQuery({
    queryKey: ["analytics", "mous"],
    queryFn: async () => {
      // Use mou_vault table (the actual source of truth for MOUs)
      const { data: vaultItems, error } = await supabase
        .from("mou_vault")
        .select("id, extraction_status, effective_start_date, effective_end_date, created_at");
      
      if (error) throw error;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const totalMous = vaultItems?.length || 0;
      
      // Active MOUs: completed extraction, within date range
      const activeMous = vaultItems?.filter(item => {
        const hasCompletedExtraction = item.extraction_status === "completed";
        const isActiveByStartDate = !item.effective_start_date || new Date(item.effective_start_date) <= today;
        const isNotExpiredByEndDate = !item.effective_end_date || (
          new Date(item.effective_end_date).setHours(0, 0, 0, 0) >= today.getTime()
        );
        return hasCompletedExtraction && isActiveByStartDate && isNotExpiredByEndDate;
      }).length || 0;
      
      // Expired MOUs: completed extraction but past end date
      const expiredMous = vaultItems?.filter(item => {
        const hasCompletedExtraction = item.extraction_status === "completed";
        const isPastEndDate = item.effective_end_date && (
          new Date(item.effective_end_date).setHours(0, 0, 0, 0) < today.getTime()
        );
        return hasCompletedExtraction && isPastEndDate;
      }).length || 0;
      
      // Pending MOUs: extraction in progress or failed
      const pendingMous = vaultItems?.filter(item => 
        item.extraction_status === "pending" || 
        item.extraction_status === "processing" ||
        item.extraction_status === "failed"
      ).length || 0;
      
      return {
        totalMous,
        activeMous,
        expiredMous,
        pendingMous,
        mous: vaultItems || []
      };
    }
  });

  return {
    vendorStats,
    issueStats,
    mouStats,
    isLoading: vendorStats.isLoading || issueStats.isLoading || mouStats.isLoading
  };
}
