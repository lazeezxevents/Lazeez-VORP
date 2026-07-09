import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ResourceAllocation {
    id: string;
    employee_id: string;
    project_id: string;
    allocated_hours_per_week: number;
    start_date: string;
    end_date: string | null;
    status: "active" | "completed" | "paused";
    allocated_by: string | null;
    created_at: string;
    // Joined
    employee_name?: string;
    employee_avatar?: string;
    project_title?: string;
}

export interface EmployeeCapacity {
    employee_id: string;
    employee_name: string;
    employee_avatar: string | null;
    department: string | null;
    totalCapacityHours: number; // 40 per week default
    allocatedHours: number;
    remainingHours: number;
    utilizationPercent: number;
    level: "underutilized" | "optimal" | "high_load" | "overloaded";
    allocations: ResourceAllocation[];
}

export function useResourceAllocations() {
    return useQuery({
        queryKey: ["resource-allocations"],
        queryFn: async () => {
            const { data, error } = await (supabase.from("resource_allocations" as any) as any)
                .select("*")
                .eq("status", "active")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url");

            const { data: projects } = await (supabase.from("projects" as any) as any)
                .select("id, title");

            const enriched: ResourceAllocation[] = (data || []).map((alloc: any) => {
                const emp = (profiles || []).find((p: any) => p.id === alloc.employee_id);
                const proj = (projects || []).find((p: any) => p.id === alloc.project_id);
                return {
                    ...alloc,
                    employee_name: (emp as any)?.full_name || "Unknown",
                    employee_avatar: (emp as any)?.avatar_url || null,
                    project_title: proj?.title || "Unknown Project",
                };
            });

            return enriched;
        },
    });
}

export function useEmployeeCapacities() {
    return useQuery({
        queryKey: ["employee-capacities"],
        queryFn: async () => {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, department_id");

            const { data: roles } = await supabase
                .from("user_roles")
                .select("user_id, role");

            const { data: departments } = await (supabase.from("departments" as any) as any)
                .select("id, name");

            const { data: allocations } = await (supabase.from("resource_allocations" as any) as any)
                .select("*")
                .eq("status", "active");

            const { data: projects } = await (supabase.from("projects" as any) as any)
                .select("id, title");

            // Build capacity for each employee with a role
            const employees = (roles || []).map((r: any) => {
                const profile = (profiles || []).find((p: any) => p.id === r.user_id);
                if (!profile) return null;
                const p = profile as any;
                const dept = (departments || []).find((d: any) => d.id === p.department_id);

                const empAllocations = (allocations || []).filter((a: any) => a.employee_id === p.id);
                const allocatedHours = empAllocations.reduce((sum: number, a: any) => sum + (a.allocated_hours_per_week || 0), 0);
                const totalCapacity = 40; // Standard work week
                const remaining = totalCapacity - allocatedHours;
                const utilization = totalCapacity > 0 ? Math.round((allocatedHours / totalCapacity) * 100) : 0;

                let level: EmployeeCapacity["level"] = "optimal";
                if (utilization < 50) level = "underutilized";
                else if (utilization >= 50 && utilization <= 85) level = "optimal";
                else if (utilization > 85 && utilization <= 100) level = "high_load";
                else level = "overloaded";

                const enrichedAllocations: ResourceAllocation[] = empAllocations.map((a: any) => {
                    const proj = (projects || []).find((pr: any) => pr.id === a.project_id);
                    return {
                        ...a,
                        employee_name: p.full_name,
                        employee_avatar: p.avatar_url,
                        project_title: proj?.title || "Unknown",
                    };
                });

                return {
                    employee_id: p.id,
                    employee_name: p.full_name || "Unknown",
                    employee_avatar: p.avatar_url,
                    department: dept?.name || null,
                    totalCapacityHours: totalCapacity,
                    allocatedHours,
                    remainingHours: remaining,
                    utilizationPercent: utilization,
                    level,
                    allocations: enrichedAllocations,
                } as EmployeeCapacity;
            }).filter(Boolean) as EmployeeCapacity[];

            return employees;
        },
    });
}

export function useAllocateResource() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: {
            employee_id: string;
            project_id: string;
            allocated_hours_per_week: number;
            start_date: string;
            end_date?: string;
        }) => {
            const { error } = await (supabase.from("resource_allocations" as any) as any).insert({
                ...data,
                end_date: data.end_date || null,
                allocated_by: user?.id,
                status: "active",
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["resource-allocations"] });
            queryClient.invalidateQueries({ queryKey: ["employee-capacities"] });
            toast.success("Resource allocated successfully");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useDeallocateResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from("resource_allocations" as any) as any)
                .update({ status: "completed" })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["resource-allocations"] });
            queryClient.invalidateQueries({ queryKey: ["employee-capacities"] });
            toast.success("Allocation removed");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
