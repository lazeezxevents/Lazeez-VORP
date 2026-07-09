import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface EmployeeHistoryEvent {
    id: string;
    employee_id: string;
    event_type: "hire" | "transfer" | "promotion" | "disciplinary" | "offboard";
    previous_data: any;
    new_data: any;
    effective_date: string;
    notes: string | null;
    created_at: string;
    // Joined
    employee_name?: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    hire: "Hired",
    transfer: "Transferred",
    promotion: "Promoted",
    disciplinary: "Disciplinary Action",
    offboard: "Offboarded",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
    hire: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    transfer: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    promotion: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    disciplinary: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    offboard: "text-slate-500 bg-slate-500/10 border-slate-500/20",
};

export { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS };

export function useEmployeeHistory(employeeId?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["employee-history", employeeId],
        queryFn: async () => {
            let q = (supabase.from("employee_history" as any) as any)
                .select("*")
                .order("effective_date", { ascending: false });

            if (employeeId) {
                q = q.eq("employee_id", employeeId);
            }

            const { data, error } = await q;
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name");

            const enriched: EmployeeHistoryEvent[] = (data || []).map((e: any) => {
                const emp = (profiles || []).find((p: any) => p.id === e.employee_id);
                return {
                    ...e,
                    employee_name: (emp as any)?.full_name || "Unknown",
                };
            });

            return enriched;
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("employee-history-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "employee_history" }, () => {
                queryClient.invalidateQueries({ queryKey: ["employee-history"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useLogLifecycleEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            employee_id: string;
            event_type: EmployeeHistoryEvent["event_type"];
            previous_data?: any;
            new_data?: any;
            notes?: string;
        }) => {
            const { error } = await (supabase.from("employee_history" as any) as any).insert({
                employee_id: data.employee_id,
                event_type: data.event_type,
                previous_data: data.previous_data || null,
                new_data: data.new_data || null,
                effective_date: new Date().toISOString(),
                notes: data.notes || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employee-history"] });
            queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            toast.success("Lifecycle event logged");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
