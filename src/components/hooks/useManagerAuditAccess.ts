import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface ManagerAuditAccessEntry {
    id: string;
    manager_id: string;
    employee_id: string;
    granted_by: string | null;
    created_at: string;
    employee_name?: string;
    employee_avatar?: string;
    employee_designation?: string;
    employee_department?: string;
    manager_name?: string;
    manager_avatar?: string;
}

export function useManagerAuditAccess(managerId?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["manager-audit-access", managerId],
        queryFn: async () => {
            let q = (supabase.from("manager_audit_access" as any) as any)
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

            const enriched: ManagerAuditAccessEntry[] = (data || []).map((entry: any) => {
                const emp = (profiles || []).find((p: any) => p.id === entry.employee_id);
                const mgr = (profiles || []).find((p: any) => p.id === entry.manager_id);
                const designation = (designations || []).find((d: any) => d.id === (emp as any)?.designation_id);
                const dept = (departments || []).find((d: any) => d.id === (emp as any)?.department_id);
                return {
                    ...entry,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    employee_avatar: (emp as any)?.avatar_url || null,
                    employee_designation: designation?.name || null,
                    employee_department: dept?.name || null,
                    manager_name: (mgr as any)?.full_name || "Unknown",
                    manager_avatar: (mgr as any)?.avatar_url || null,
                };
            });

            return enriched;
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("manager-audit-access-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "manager_audit_access" }, () => {
                queryClient.invalidateQueries({ queryKey: ["manager-audit-access"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useAllAuditAccessEntries() {
    return useQuery({
        queryKey: ["all-audit-access"],
        queryFn: async () => {
            const { data, error } = await (supabase.from("manager_audit_access" as any) as any)
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, department_id, designation_id");

            const { data: designations } = await supabase
                .from("designations")
                .select("id, name");

            const { data: departments } = await (supabase.from("departments" as any) as any)
                .select("id, name");

            return (data || []).map((entry: any) => {
                const emp = (profiles || []).find((p: any) => p.id === entry.employee_id);
                const mgr = (profiles || []).find((p: any) => p.id === entry.manager_id);
                const designation = (designations || []).find((d: any) => d.id === (emp as any)?.designation_id);
                const dept = (departments || []).find((d: any) => d.id === (emp as any)?.department_id);
                return {
                    ...entry,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    employee_avatar: (emp as any)?.avatar_url || null,
                    employee_designation: designation?.name || null,
                    employee_department: dept?.name || null,
                    manager_name: (mgr as any)?.full_name || "Unknown",
                    manager_avatar: (mgr as any)?.avatar_url || null,
                } as ManagerAuditAccessEntry;
            });
        },
    });
}

export function useAssignAuditAccess() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: { manager_id: string; employee_id: string }) => {
            const { error } = await (supabase.from("manager_audit_access" as any) as any).insert({
                ...data,
                granted_by: user?.id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["manager-audit-access"] });
            queryClient.invalidateQueries({ queryKey: ["all-audit-access"] });
            toast.success("Audit access granted");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useRevokeAuditAccess() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from("manager_audit_access" as any) as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["manager-audit-access"] });
            queryClient.invalidateQueries({ queryKey: ["all-audit-access"] });
            toast.success("Audit access revoked");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
