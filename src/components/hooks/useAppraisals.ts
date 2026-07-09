import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface AppraisalReview {
    id: string;
    employee_id: string;
    reviewer_id: string;
    review_type: "manager" | "peer" | "self" | "subordinate";
    period_start: string;
    period_end: string;
    collaboration_score: number;
    reliability_score: number;
    quality_score: number;
    innovation_score: number;
    comments: string | null;
    created_at: string;
    // Joined
    employee_name?: string;
    reviewer_name?: string;
    avg_score?: number;
}

export interface AppraisalAggregate {
    employee_id: string;
    employee_name: string;
    avgCollaboration: number;
    avgReliability: number;
    avgQuality: number;
    avgInnovation: number;
    overallAvg: number;
    reviewCount: number;
    byType: Record<string, AppraisalReview[]>;
}

export function useAppraisalReviews(employeeId?: string | null, reviewType?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["appraisal-reviews", employeeId, reviewType],
        queryFn: async () => {
            let q = (supabase.from("appraisal_reviews" as any) as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (employeeId) {
                q = q.eq("employee_id", employeeId);
            }
            if (reviewType && reviewType !== "all") {
                q = q.eq("review_type", reviewType);
            }

            const { data, error } = await q;
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name");

            const enriched: AppraisalReview[] = (data || []).map((r: any) => {
                const emp = (profiles || []).find((p: any) => p.id === r.employee_id);
                const reviewer = (profiles || []).find((p: any) => p.id === r.reviewer_id);
                const avgScore = (
                    (r.collaboration_score || 0) +
                    (r.reliability_score || 0) +
                    (r.quality_score || 0) +
                    (r.innovation_score || 0)
                ) / 4;
                return {
                    ...r,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    reviewer_name: (reviewer as any)?.full_name || "Unknown",
                    avg_score: Math.round(avgScore * 10) / 10,
                };
            });

            return enriched;
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("appraisal-reviews-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "appraisal_reviews" }, () => {
                queryClient.invalidateQueries({ queryKey: ["appraisal-reviews"] });
                queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useAppraisalAggregate(employeeId: string) {
    return useQuery({
        queryKey: ["appraisal-aggregate", employeeId],
        queryFn: async () => {
            const { data, error } = await (supabase.from("appraisal_reviews" as any) as any)
                .select("*")
                .eq("employee_id", employeeId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name");

            const emp = (profiles || []).find((p: any) => p.id === employeeId);
            const reviews = data || [];

            if (reviews.length === 0) return null;

            const avgField = (field: string) =>
                Math.round((reviews.reduce((sum: number, r: any) => sum + (r[field] || 0), 0) / reviews.length) * 10) / 10;

            const byType: Record<string, AppraisalReview[]> = {};
            reviews.forEach((r: any) => {
                if (!byType[r.review_type]) byType[r.review_type] = [];
                const reviewer = (profiles || []).find((p: any) => p.id === r.reviewer_id);
                byType[r.review_type].push({
                    ...r,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    reviewer_name: (reviewer as any)?.full_name || "Unknown",
                    avg_score: Math.round(((r.collaboration_score + r.reliability_score + r.quality_score + r.innovation_score) / 4) * 10) / 10,
                });
            });

            const aggregate: AppraisalAggregate = {
                employee_id: employeeId,
                employee_name: (emp as any)?.full_name || "Unknown",
                avgCollaboration: avgField("collaboration_score"),
                avgReliability: avgField("reliability_score"),
                avgQuality: avgField("quality_score"),
                avgInnovation: avgField("innovation_score"),
                overallAvg: Math.round(((avgField("collaboration_score") + avgField("reliability_score") + avgField("quality_score") + avgField("innovation_score")) / 4) * 10) / 10,
                reviewCount: reviews.length,
                byType,
            };

            return aggregate;
        },
        enabled: !!employeeId,
    });
}

export function useSubmitReview() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: {
            employee_id: string;
            review_type: AppraisalReview["review_type"];
            period_start: string;
            period_end: string;
            collaboration_score: number;
            reliability_score: number;
            quality_score: number;
            innovation_score: number;
            comments?: string;
        }) => {
            const { error } = await (supabase.from("appraisal_reviews" as any) as any).insert({
                ...data,
                reviewer_id: user?.id,
                comments: data.comments || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appraisal-reviews"] });
            queryClient.invalidateQueries({ queryKey: ["appraisal-aggregate"] });
            queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            toast.success("Review submitted successfully");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
