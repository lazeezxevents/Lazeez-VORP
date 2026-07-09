import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Sprints ───────────────────────────────────────────────

export interface Sprint {
    id: string;
    project_id: string;
    name: string;
    goal: string | null;
    status: "planning" | "active" | "completed";
    start_date: string | null;
    end_date: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export function useSprints(projectId?: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: sprints = [], isLoading } = useQuery({
        queryKey: ["sprints", projectId],
        queryFn: async () => {
            if (!projectId) return [];
            const { data, error } = await supabase
                .from("sprints")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as Sprint[];
        },
        enabled: !!projectId,
    });

    const createSprint = useMutation({
        mutationFn: async (sprint: Partial<Sprint>) => {
            const { data, error } = await supabase
                .from("sprints")
                .insert({ ...sprint, project_id: projectId, created_by: user?.id })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
            toast.success("Sprint created");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateSprint = useMutation({
        mutationFn: async (updates: Partial<Sprint> & { id: string }) => {
            const { id, ...rest } = updates;
            const { error } = await supabase.from("sprints").update(rest).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
            toast.success("Sprint updated");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteSprint = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("sprints").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
            toast.success("Sprint deleted");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return { sprints, isLoading, createSprint, updateSprint, deleteSprint };
}

// ─── Milestones ────────────────────────────────────────────

export interface Milestone {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    target_date: string | null;
    status: "pending" | "in_progress" | "completed" | "missed";
    completed_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export function useMilestones(projectId?: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: milestones = [], isLoading } = useQuery({
        queryKey: ["milestones", projectId],
        queryFn: async () => {
            if (!projectId) return [];
            const { data, error } = await supabase
                .from("milestones")
                .select("*")
                .eq("project_id", projectId)
                .order("target_date", { ascending: true });
            if (error) throw error;
            return data as Milestone[];
        },
        enabled: !!projectId,
    });

    const createMilestone = useMutation({
        mutationFn: async (milestone: Partial<Milestone>) => {
            const { data, error } = await supabase
                .from("milestones")
                .insert({ ...milestone, project_id: projectId, created_by: user?.id })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
            toast.success("Milestone created");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMilestone = useMutation({
        mutationFn: async (updates: Partial<Milestone> & { id: string }) => {
            const { id, ...rest } = updates;
            const { error } = await supabase.from("milestones").update(rest).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
            toast.success("Milestone updated");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return { milestones, isLoading, createMilestone, updateMilestone };
}

// ─── Activity Feed ─────────────────────────────────────────

export interface ActivityItem {
    id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    description: string;
    metadata: Record<string, any>;
    user_id: string | null;
    created_at: string;
}

export function useActivityFeed(options?: { projectId?: string; limit?: number }) {
    const limit = options?.limit || 30;

    return useQuery({
        queryKey: ["activity-feed", options?.projectId, limit],
        queryFn: async () => {
            let query = supabase
                .from("activity_feed")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(limit);

            // If scoped to a project, filter by project metadata
            if (options?.projectId) {
                query = query.or(
                    `metadata->>project_id.eq.${options.projectId},entity_id.eq.${options.projectId}`
                );
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as ActivityItem[];
        },
    });
}

// ─── Workload Tracking ─────────────────────────────────────

export interface DeveloperWorkload {
    userId: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
    tasksTodo: number;
    tasksInProgress: number;
    tasksReview: number;
    tasksDone: number;
    totalTasks: number;
    estimatedHours: number;
    actualHours: number;
    overdueTasks: number;
}

export function useWorkloadTracking(projectId?: string) {
    return useQuery({
        queryKey: ["workload", projectId],
        queryFn: async () => {
            if (!projectId) return [];

            const [tasksRes, profilesRes] = await Promise.all([
                supabase
                    .from("project_tasks")
                    .select("id, assigned_to, status, due_date, estimated_hours, actual_hours")
                    .eq("project_id", projectId),
                supabase
                    .from("profiles")
                    .select("id, full_name, email, avatar_url"),
            ]);

            if (tasksRes.error) throw tasksRes.error;
            const tasks = tasksRes.data || [];
            const profiles = profilesRes.data || [];

            // Group by assigned_to
            const assigneeMap = new Map<string, typeof tasks>();
            tasks.forEach(t => {
                if (!t.assigned_to) return;
                const arr = assigneeMap.get(t.assigned_to) || [];
                arr.push(t);
                assigneeMap.set(t.assigned_to, arr);
            });

            const now = new Date();
            const workloads: DeveloperWorkload[] = [];

            assigneeMap.forEach((userTasks, userId) => {
                const profile = profiles.find(p => p.id === userId);
                workloads.push({
                    userId,
                    fullName: profile?.full_name || null,
                    email: profile?.email || userId,
                    avatarUrl: profile?.avatar_url || null,
                    tasksTodo: userTasks.filter(t => t.status === "todo").length,
                    tasksInProgress: userTasks.filter(t => t.status === "in_progress").length,
                    tasksReview: userTasks.filter(t => t.status === "review").length,
                    tasksDone: userTasks.filter(t => t.status === "done").length,
                    totalTasks: userTasks.length,
                    estimatedHours: userTasks.reduce((s, t) => s + (Number(t.estimated_hours) || 0), 0),
                    actualHours: userTasks.reduce((s, t) => s + (Number(t.actual_hours) || 0), 0),
                    overdueTasks: userTasks.filter(t =>
                        t.due_date && new Date(t.due_date) < now && t.status !== "done"
                    ).length,
                });
            });

            return workloads.sort((a, b) => b.totalTasks - a.totalTasks);
        },
        enabled: !!projectId,
    });
}
