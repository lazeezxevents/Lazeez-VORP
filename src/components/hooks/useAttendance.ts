import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface AttendanceLog {
    id: string;
    employee_id: string;
    check_in: string;
    check_out: string | null;
    status: "present" | "late" | "absent" | "on_leave";
    notes: string | null;
    created_at: string;
    // Joined
    employee_name?: string;
    employee_email?: string;
    department_name?: string;
}

export interface AttendanceSummary {
    presentToday: number;
    lateToday: number;
    absentToday: number;
    onLeaveToday: number;
    totalLogged: number;
}

export interface MonthlyAttendanceDay {
    date: string;
    status: AttendanceLog["status"] | null;
    checkIn?: string;
    checkOut?: string;
}

export function useAttendanceLogs(deptId?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["attendance-logs", deptId],
        queryFn: async () => {
            const { data: logs, error } = await (supabase.from("attendance_logs" as any) as any)
                .select("*")
                .order("check_in", { ascending: false })
                .limit(200);

            if (error) throw error;

            // Fetch profiles for names
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, email, department_id");

            const { data: departments } = await (supabase.from("departments" as any) as any)
                .select("id, name");

            const enriched: AttendanceLog[] = (logs || []).map((log: any) => {
                const profile = (profiles || []).find((p: any) => p.id === log.employee_id);
                const dept = (departments || []).find((d: any) => d.id === (profile as any)?.department_id);
                return {
                    ...log,
                    employee_name: (profile as any)?.full_name || "Unknown",
                    employee_email: (profile as any)?.email || "",
                    department_name: dept?.name || "Unassigned",
                };
            });

            // Filter by department if specified
            const filtered = deptId
                ? enriched.filter(l => {
                    const profile = (profiles || []).find((p: any) => p.id === l.employee_id);
                    return (profile as any)?.department_id === deptId;
                })
                : enriched;

            // Today's summary
            const today = new Date().toISOString().split("T")[0];
            const todayLogs = filtered.filter(l => l.check_in.startsWith(today));

            const summary: AttendanceSummary = {
                presentToday: todayLogs.filter(l => l.status === "present").length,
                lateToday: todayLogs.filter(l => l.status === "late").length,
                absentToday: todayLogs.filter(l => l.status === "absent").length,
                onLeaveToday: todayLogs.filter(l => l.status === "on_leave").length,
                totalLogged: todayLogs.length,
            };

            return { logs: filtered, summary };
        },
    });

    // Realtime subscription for live updates
    useEffect(() => {
        const channel = supabase
            .channel("attendance-logs-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => {
                queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
                queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    return query;
}

export function useEmployeeMonthlyAttendance(employeeId: string, year: number, month: number) {
    return useQuery({
        queryKey: ["employee-monthly-attendance", employeeId, year, month],
        queryFn: async () => {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const endDate = new Date(year, month, 0); // Last day of month
            const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

            const { data, error } = await (supabase.from("attendance_logs" as any) as any)
                .select("*")
                .eq("employee_id", employeeId)
                .gte("check_in", startDate + "T00:00:00")
                .lte("check_in", endDateStr + "T23:59:59")
                .order("check_in", { ascending: true });

            if (error) throw error;

            // Build calendar data
            const daysInMonth = endDate.getDate();
            const calendar: MonthlyAttendanceDay[] = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayLog = (data || []).find((l: any) => l.check_in.startsWith(dateStr));

                calendar.push({
                    date: dateStr,
                    status: dayLog ? dayLog.status : null,
                    checkIn: dayLog?.check_in,
                    checkOut: dayLog?.check_out,
                });
            }

            // Stats
            const totalWorking = calendar.filter(d => d.status !== null).length;
            const present = calendar.filter(d => d.status === "present" || d.status === "late").length;
            const rate = totalWorking > 0 ? Math.round((present / totalWorking) * 100) : 100;

            return { calendar, attendanceRate: rate, totalDays: daysInMonth, totalPresent: present };
        },
        enabled: !!employeeId,
    });
}

export function useMarkAttendance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            employee_id: string;
            status: AttendanceLog["status"];
            notes?: string;
        }) => {
            const { error } = await (supabase.from("attendance_logs" as any) as any).insert({
                employee_id: data.employee_id,
                status: data.status,
                check_in: new Date().toISOString(),
                notes: data.notes || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
            queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            toast.success("Attendance marked successfully");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useSelfCheckIn() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (notes?: string) => {
            const now = new Date();
            const hour = now.getHours();
            // Determine status based on time (late if after 9:30 AM)
            const status = hour >= 10 ? "late" : "present";

            const { error } = await (supabase.from("attendance_logs" as any) as any).insert({
                employee_id: user?.id,
                status,
                check_in: now.toISOString(),
                notes: notes || null,
            });
            if (error) throw error;
            return status;
        },
        onSuccess: (status) => {
            queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
            queryClient.invalidateQueries({ queryKey: ["employee-performance"] });
            toast.success(status === "late" ? "Checked in (late)" : "Checked in successfully");
        },
        onError: (err: any) => toast.error(err.message),
    });
}

export function useCheckOut() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (logId: string) => {
            const { error } = await (supabase.from("attendance_logs" as any) as any)
                .update({ check_out: new Date().toISOString() })
                .eq("id", logId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
            toast.success("Check-out recorded");
        },
        onError: (err: any) => toast.error(err.message),
    });
}
