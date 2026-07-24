import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SafiScoreDetails {
    vendorId: string;
    id: string; // Alias for vendorId used in UI
    vendorName: string;
    category: string;
    status: string;
    score: number;
    ratingScore: number;
    issuePenalty: number;
    paymentBonus: number;
    breakdown: {
      rawRating: number;
      orderCount: number;
      openIssues: number;
      criticalIssues: number;
      resolvedIssues: number;
      resolutionScore: number;
      timelyPayments: number;
      pendingPayments: number;
    };
}

export function useSafiScore(vendorId?: string) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ["safi-scores", vendorId || "all"],
        queryFn: async () => {
            // Fetch all required data
            let vendorsQuery = supabase.from("vendors").select("id, name, category, rating, status");
            if (vendorId) vendorsQuery = vendorsQuery.eq("id", vendorId);
            const { data: vendors } = await vendorsQuery;

            let issuesQuery = supabase.from("issues").select("vendor_id, status, priority, created_at, resolved_at");
            if (vendorId) issuesQuery = issuesQuery.eq("vendor_id", vendorId);
            const { data: issues } = await issuesQuery;

            let paymentsQuery = supabase.from("vendor_payments").select("vendor_id, upfront_paid_at, remaining_released_at");
            if (vendorId) paymentsQuery = paymentsQuery.eq("vendor_id", vendorId);
            const { data: payments } = await paymentsQuery;

            if (!vendors || !issues || !payments) {
                return [];
            }

            const scores: SafiScoreDetails[] = vendors.map((vendor) => {
                const vendorIssues = issues.filter((i) => i.vendor_id === vendor.id);
                const vendorPayments = payments.filter((p) => p.vendor_id === vendor.id);

                const orderCount = vendorPayments.length;
                const rawRating = vendor.rating || 0;
                const ratingScore = (rawRating / 5) * 40;

                // 2. Issues Penalty (Max penalty: -30 points)
                const openIssues = vendorIssues.filter((i) => i.status === "open" || i.status === "in_progress").length;
                const criticalIssues = vendorIssues.filter((i) => i.priority === "critical").length;
                const resolvedIssues = vendorIssues.filter((i) => i.status === "resolved" || i.status === "closed").length;

                const totalIssues = vendorIssues.length;
                const resolutionScore = totalIssues === 0
                    ? 100
                    : vendorIssues.reduce((sum, issue: any) => {
                        if (!issue.resolved_at) return sum;
                        const days = Math.max(0, (new Date(issue.resolved_at).getTime() - new Date(issue.created_at).getTime()) / 86_400_000);
                        return sum + (days <= 7 ? 100 : days <= 30 ? 70 : 40);
                    }, 0) / Math.max(1, resolvedIssues);
                const issueQuality = Math.max(0, Math.min(100,
                    (resolvedIssues / Math.max(1, totalIssues)) * 70 - (openIssues * 15) - (criticalIssues * 20) + (totalIssues === 0 ? 30 : 0)
                ));
                const issuePenalty = Math.round(issueQuality - 70);

                // 3. Payments Bonus/Penalty (Max bonus: 40 points)
                const timelyPayments = vendorPayments.filter((p) => p.upfront_paid_at && p.remaining_released_at).length;
                const pendingPayments = vendorPayments.filter((p) => !p.upfront_paid_at || !p.remaining_released_at).length;

                const paymentReliability = orderCount === 0 ? 0 : (timelyPayments / orderCount) * 100;
                const volumeConfidence = Math.min(1, orderCount / 10);
                const paymentBonus = Math.round((paymentReliability - 50) * 0.25);

                // Calculate Final SAFI Score (0 to 100)
                // No orders means there is no performance evidence, so do not
                // display the old misleading neutral score of 50.
                const evidenceScore = ratingScore + (paymentReliability * 0.25) + (issueQuality * 0.25) + (resolutionScore * 0.10);
                let finalScore = evidenceScore * volumeConfidence;

                finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

                return {
                    vendorId: vendor.id,
                    id: vendor.id,
                    vendorName: vendor.name,
                    category: vendor.category,
                    status: vendor.status,
                    score: finalScore,
                    ratingScore,
                    issuePenalty,
                    paymentBonus,
                    breakdown: {
                        rawRating,
                        orderCount,
                        openIssues,
                        criticalIssues,
                        resolvedIssues,
                        resolutionScore: Math.round(resolutionScore),
                        timelyPayments,
                        pendingPayments,
                    },
                };
            });

            // Sort descending by score
            return scores.sort((a, b) => b.score - a.score);
        },
        enabled: !!user,
    });
}
