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
        openIssues: number;
        criticalIssues: number;
        resolvedIssues: number;
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

            let issuesQuery = supabase.from("issues").select("vendor_id, status, priority");
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

                // 1. Rating Score (Base: 50 points max)
                // Rating is out of 5. Each star is worth 10 points.
                const rawRating = vendor.rating || 0;
                const ratingScore = rawRating * 10;

                // 2. Issues Penalty (Max penalty: -30 points)
                const openIssues = vendorIssues.filter((i) => i.status === "open" || i.status === "in_progress").length;
                const criticalIssues = vendorIssues.filter((i) => i.priority === "critical").length;
                const resolvedIssues = vendorIssues.filter((i) => i.status === "resolved" || i.status === "closed").length;

                // Formula: -5 for each critical issue, -2 for each open issue, +1 for each resolved issue
                let issuePenalty = (criticalIssues * -5) + (openIssues * -2) + (resolvedIssues * 1);
                // Cap penalty at -30, cap bonus at +10
                issuePenalty = Math.max(-30, Math.min(10, issuePenalty));

                // 3. Payments Bonus/Penalty (Max bonus: 40 points)
                const timelyPayments = vendorPayments.filter((p) => p.upfront_paid_at && p.remaining_released_at).length;
                const pendingPayments = vendorPayments.filter((p) => !p.upfront_paid_at || !p.remaining_released_at).length;

                // Formula: +5 for each fully paid order, -2 for each pending
                let paymentBonus = (timelyPayments * 5) + (pendingPayments * -2);
                // Cap bonus at 40
                paymentBonus = Math.max(-20, Math.min(40, paymentBonus));

                // Calculate Final SAFI Score (0 to 100)
                let finalScore = ratingScore + issuePenalty + paymentBonus;

                // Base score for new vendors without data
                if (rawRating === 0 && vendorIssues.length === 0 && vendorPayments.length === 0) {
                    finalScore = 50; // Neutral starting score
                }

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
                        openIssues,
                        criticalIssues,
                        resolvedIssues,
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
