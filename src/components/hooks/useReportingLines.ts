import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface ReportingLine {
    id: string;
    employee_id: string;
    manager_id: string;
    relationship_type: "direct_manager" | "project_manager" | "dotted_line";
    created_at: string;
    employee_name?: string;
    manager_name?: string;
    employee_avatar?: string;
    manager_avatar?: string;
    employee_designation?: string;
    employee_department?: string;
}

export function useReportingLines(managerId?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["reporting-lines", managerId],
        queryFn: async () => {
            let q = (supabase.from("reporting_lines" as any) as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (managerId) {
                q = q.eq("manager_id", managerId);
            }

            const { data, error } = await q;
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, department_id, designation_id");

            const { data: designations } = await supabase
                .from("designations")
                .select("id, name");

            const { data: departments } = await (supabase.from("departments" as any) as any)
                .select("id, name");

            const enriched: ReportingLine[] = (data || []).map((line: any) => {
                const emp = (profiles || []).find((p: any) => p.id === line.employee_id);
                const mgr = (profiles || []).find((p: any) => p.id === line.manager_id);
                const designation = (designations || []).find((d: any) => d.id === (emp as any)?.designation_id);
                const dept = (departments || []).find((d: any) => d.id === (emp as any)?.department_id);
                return {
                    ...line,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    manager_name: (mgr as any)?.full_name || "Unknown",
                    employee_avatar: (emp as any)?.avatar_url || null,
                    manager_avatar: (mgr as any)?.avatar_url || null,
                    employee_designation: designation?.name || null,
                    employee_department: dept?.name || null,
                };
            });

            return enriched;
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("reporting-lines-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "reporting_lines" }, () => {
                queryClient.invalidateQueries({ queryKey: ["reporting-lines"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useEmployeeManagers(employeeId: string) {
    return useQuery({
        queryKey: ["employee-managers", employeeId],
        queryFn: async () => {
            const { data, error } = await (supabase.from("reporting_lines" as any) as any)
                .select("*")
                .eq("employee_id", employeeId);
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url");

            return (data || []).map((line: any) => {
                const mgr = (profiles || []).find((p: any) => p.id === line.manager_id);
                return {
                    ...line,
                    manager_name: (mgr as any)?.full_name || "Unknown",
                    manager_avatar: (mgr as any)?.avatar_url || null,
                };
            });
        },
        enabled: !!employeeId,
    });
}

export function useAssignReportingLine() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            employee_id: string;
            manager_id: string;
            relationship_type: ReportingLine["relationship_type"];
        }) => {
            const { error } = await (supabase.from("reporting_lines" as any) as any).insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reporting-lines"] });
            queryClient.invalidateQueries({ queryKey: ["employee-managers"] });
            toast.success("Reporting line created");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useRemoveReportingLine() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from("reporting_lines" as any) as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reporting-lines"] });
            queryClient.invalidateQueries({ queryKey: ["employee-managers"] });
            toast.success("Reporting line removed");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
