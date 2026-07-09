import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface LeaveRequest {
    id: string;
    employee_id: string;
    leave_type: "annual" | "sick" | "maternity" | "unpaid";
    start_date: string;
    end_date: string;
    status: "pending" | "approved" | "rejected";
    reason: string | null;
    approved_by: string | null;
    created_at: string;
    // Joined
    employee_name?: string;
    employee_email?: string;
    approver_name?: string;
}

export interface LeaveBalance {
    annual: { total: number; used: number; remaining: number };
    sick: { total: number; used: number; remaining: number };
    maternity: { total: number; used: number; remaining: number };
    unpaid: { used: number };
}

export function useLeaveRequests(statusFilter?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["leave-requests", statusFilter],
        queryFn: async () => {
            let q = (supabase.from("leave_requests" as any) as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (statusFilter && statusFilter !== "all") {
                q = q.eq("status", statusFilter);
            }

            const { data, error } = await q;
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, email");

            const enriched: LeaveRequest[] = (data || []).map((req: any) => {
                const emp = (profiles || []).find((p: any) => p.id === req.employee_id);
                const approver = req.approved_by
                    ? (profiles || []).find((p: any) => p.id === req.approved_by)
                    : null;
                return {
                    ...req,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    employee_email: (emp as any)?.email || "",
                    approver_name: (approver as any)?.full_name || null,
                };
            });

            const pendingCount = enriched.filter(r => r.status === "pending").length;

            return { requests: enriched, pendingCount };
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("leave-requests-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
                queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useEmployeeLeaveBalance(employeeId: string) {
    return useQuery({
        queryKey: ["leave-balance", employeeId],
        queryFn: async () => {
            const currentYear = new Date().getFullYear();
            const yearStart = `${currentYear}-01-01`;

            const { data, error } = await (supabase.from("leave_requests" as any) as any)
                .select("*")
                .eq("employee_id", employeeId)
                .eq("status", "approved")
                .gte("start_date", yearStart);

            if (error) throw error;

            const countDays = (leaves: any[], type: string) => {
                return leaves
                    .filter((l: any) => l.leave_type === type)
                    .reduce((sum: number, l: any) => {
                        const start = new Date(l.start_date);
                        const end = new Date(l.end_date);
                        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        return sum + days;
                    }, 0);
            };

            const balance: LeaveBalance = {
                annual: { total: 20, used: countDays(data || [], "annual"), remaining: 20 - countDays(data || [], "annual") },
                sick: { total: 10, used: countDays(data || [], "sick"), remaining: 10 - countDays(data || [], "sick") },
                maternity: { total: 90, used: countDays(data || [], "maternity"), remaining: 90 - countDays(data || [], "maternity") },
                unpaid: { used: countDays(data || [], "unpaid") },
            };

            return balance;
        },
        enabled: !!employeeId,
    });
}

export function useSubmitLeave() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: {
            leave_type: LeaveRequest["leave_type"];
            start_date: string;
            end_date: string;
            reason?: string;
        }) => {
            const { error } = await (supabase.from("leave_requests" as any) as any).insert({
                employee_id: user?.id,
                leave_type: data.leave_type,
                start_date: data.start_date,
                end_date: data.end_date,
                reason: data.reason || null,
                status: "pending",
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            toast.success("Leave request submitted");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useApproveRejectLeave() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: { id: string; action: "approved" | "rejected" }) => {
            const { error } = await (supabase.from("leave_requests" as any) as any)
                .update({
                    status: data.action,
                    approved_by: user?.id,
                })
                .eq("id", data.id);
            if (error) throw error;
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
            toast.success(`Leave request ${vars.action}`);
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useBulkApproveLeaves() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await (supabase.from("leave_requests" as any) as any)
                .update({
                    status: "approved",
                    approved_by: user?.id,
                })
                .in("id", ids);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
            toast.success("Selected leave requests approved");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
