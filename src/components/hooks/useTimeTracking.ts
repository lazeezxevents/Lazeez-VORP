import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface TimeLog {
    id: string;
    employee_id: string;
    task_id: string | null;
    project_id: string | null;
    description: string | null;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    is_idle: boolean;
    log_type: "work" | "break" | "meeting" | "review" | "idle";
    created_at: string;
    // Joined
    employee_name?: string;
    task_title?: string;
    project_title?: string;
}

export interface TimeSummary {
    totalMinutesToday: number;
    activeMinutesToday: number;
    idleMinutesToday: number;
    breakMinutesToday: number;
    currentSession: TimeLog | null;
}

export function useTimeLogs(employeeId?: string | null, dateRange?: { from: string; to: string }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const targetId = employeeId || user?.id;

    const query = useQuery({
        queryKey: ["time-logs", targetId, dateRange?.from, dateRange?.to],
        queryFn: async () => {
            let q = (supabase.from("time_logs" as any) as any)
                .select("*")
                .order("start_time", { ascending: false })
                .limit(200);

            if (targetId) {
                q = q.eq("employee_id", targetId);
            }

            if (dateRange?.from) {
                q = q.gte("start_time", dateRange.from);
            }
            if (dateRange?.to) {
                q = q.lte("start_time", dateRange.to);
            }

            const { data, error } = await q;
            if (error) throw error;

            // Enrich with profiles
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name");

            const enriched: TimeLog[] = (data || []).map((log: any) => {
                const emp = (profiles || []).find((p: any) => p.id === log.employee_id);
                return {
                    ...log,
                    employee_name: (emp as any)?.full_name || "Unknown",
                };
            });

            // Today's summary
            const today = new Date().toISOString().split("T")[0];
            const todayLogs = enriched.filter(l => l.start_time.startsWith(today));

            const totalMinutes = todayLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
            const activeMinutes = todayLogs.filter(l => l.log_type === "work" || l.log_type === "meeting" || l.log_type === "review")
                .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
            const idleMinutes = todayLogs.filter(l => l.is_idle || l.log_type === "idle")
                .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
            const breakMinutes = todayLogs.filter(l => l.log_type === "break")
                .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

            const currentSession = todayLogs.find(l => !l.end_time) || null;

            const summary: TimeSummary = {
                totalMinutesToday: totalMinutes,
                activeMinutesToday: activeMinutes,
                idleMinutesToday: idleMinutes,
                breakMinutesToday: breakMinutes,
                currentSession,
            };

            return { logs: enriched, summary };
        },
        enabled: !!targetId,
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("time-logs-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "time_logs" }, () => {
                queryClient.invalidateQueries({ queryKey: ["time-logs"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useTeamTimeLogs(managerId: string) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ["team-time-logs", managerId],
        queryFn: async () => {
            // Get all employees under this manager
            const { data: reportingLines } = await (supabase.from("reporting_lines" as any) as any)
                .select("employee_id")
                .eq("manager_id", managerId);

            const employeeIds = (reportingLines || []).map((r: any) => r.employee_id);
            if (employeeIds.length === 0) return [];

            const today = new Date().toISOString().split("T")[0];

            const { data: logs, error } = await (supabase.from("time_logs" as any) as any)
                .select("*")
                .in("employee_id", employeeIds)
                .gte("start_time", today + "T00:00:00")
                .order("start_time", { ascending: false });

            if (error) throw error;

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url");

            // Group by employee
            const grouped = employeeIds.map((empId: string) => {
                const empLogs = (logs || []).filter((l: any) => l.employee_id === empId);
                const profile = (profiles || []).find((p: any) => p.id === empId);
                const totalMinutes = empLogs.reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0);
                const idleMinutes = empLogs.filter((l: any) => l.is_idle || l.log_type === "idle")
                    .reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0);
                const activeTasks = empLogs.filter((l: any) => !l.end_time).length;

                return {
                    employee_id: empId,
                    employee_name: (profile as any)?.full_name || "Unknown",
                    employee_avatar: (profile as any)?.avatar_url || null,
                    totalMinutesToday: totalMinutes,
                    idleMinutesToday: idleMinutes,
                    activeTasksNow: activeTasks,
                    isOnline: activeTasks > 0,
                };
            });

            return grouped;
        },
        enabled: !!managerId,
    });
}

export function useStartTimeEntry() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: {
            task_id?: string;
            project_id?: string;
            description?: string;
            log_type?: TimeLog["log_type"];
        }) => {
            const { error } = await (supabase.from("time_logs" as any) as any).insert({
                employee_id: user?.id,
                task_id: data.task_id || null,
                project_id: data.project_id || null,
                description: data.description || null,
                log_type: data.log_type || "work",
                start_time: new Date().toISOString(),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-logs"] });
            toast.success("Timer started");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useStopTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (logId: string) => {
            // Get the start time first
            const { data: log } = await (supabase.from("time_logs" as any) as any)
                .select("start_time")
                .eq("id", logId)
                .single();

            const endTime = new Date();
            const startTime = new Date(log.start_time);
            const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

            const { error } = await (supabase.from("time_logs" as any) as any)
                .update({
                    end_time: endTime.toISOString(),
                    duration_minutes: durationMinutes,
                })
                .eq("id", logId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-logs"] });
            toast.success("Timer stopped");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
