import { useState } from "react";
import { Clock, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { exportToCSV, formatAttendanceForExport } from "@/utils/exportUtils";
import { AttendanceLog, AttendanceSummary } from "@/hooks/useAttendance";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";

interface AttendanceTabProps {
    attendanceData: {
        logs: AttendanceLog[];
        summary: AttendanceSummary;
    } | undefined;
    isStaff: boolean;
    employees: EmployeeKPI[];
    markAttendanceMutation: {
        mutate: (data: { employee_id: string; status: AttendanceLog["status"]; notes?: string }) => void;
        isPending: boolean
    };
}

export function AttendanceTab({
    attendanceData,
    isStaff,
    employees,
    markAttendanceMutation
}: AttendanceTabProps) {
    const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
    const [attendanceForm, setAttendanceForm] = useState({
        employee_id: "",
        status: "present" as "present" | "late" | "absent" | "on_leave",
        notes: ""
    });

    const handleMarkAttendance = () => {
        markAttendanceMutation.mutate(attendanceForm);
        setAttendanceDialogOpen(false);
        setAttendanceForm({ employee_id: "", status: "present", notes: "" });
    };

    const handleExport = () => {
        if (attendanceData?.logs) {
            const formatted = formatAttendanceForExport(attendanceData.logs);
            exportToCSV(formatted, "Attendance_Report", Object.keys(formatted[0]));
        }
    };

    const summary = [
        { label: "Present", value: attendanceData?.summary?.presentToday || 0, color: "text-emerald-500 bg-emerald-500/10" },
        { label: "Late", value: attendanceData?.summary?.lateToday || 0, color: "text-amber-500 bg-amber-500/10" },
        { label: "Absent", value: attendanceData?.summary?.absentToday || 0, color: "text-rose-500 bg-rose-500/10" },
        { label: "On Leave", value: attendanceData?.summary?.onLeaveToday || 0, color: "text-blue-500 bg-blue-500/10" },
    ];

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-lg font-bold text-foreground">Attendance Tracker</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
                        <Download className="w-4 h-4" />
                        Export CSV
                    </Button>
                    {isStaff && (
                        <Button size="sm" onClick={() => setAttendanceDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 rounded-xl">
                            <Clock className="w-4 h-4" />
                            Mark Attendance
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summary.map((s, i) => (
                    <Card key={i} className="border-none shadow-sm animate-stagger-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <CardContent className="p-4 text-center">
                            <p className={cn("text-2xl font-bold", s.color.split(" ")[0])}>{s.value}</p>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label} Today</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm overflow-hidden animate-slide-up">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Check in</th>
                                    <th className="px-6 py-4">Check out</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {(attendanceData?.logs || []).slice(0, 50).map((log, i) => (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4 text-sm font-semibold">{log.employee_name}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(log.check_in).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-medium">{new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {log.check_out
                                                ? new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : <Badge variant="outline" className="text-[9px] font-bold text-blue-500 border-blue-200 bg-blue-50/50">Active</Badge>
                                            }
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className={cn("text-[10px] font-bold",
                                                log.status === 'present' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    log.status === 'late' ? 'bg-amber-500/10 text-amber-500' :
                                                        log.status === 'absent' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                                            )}>
                                                {log.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {(!attendanceData?.logs?.length) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm italic font-light">
                                            No attendance records found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Mark attendance</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">Record attendance for an employee.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Select Employee</Label>
                            <Select value={attendanceForm.employee_id} onValueChange={v => setAttendanceForm(f => ({ ...f, employee_id: v }))}>
                                <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 focus:ring-primary/20 font-bold text-xs"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-muted-foreground/20">
                                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName || e.email}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Status</Label>
                            <Select value={attendanceForm.status} onValueChange={(v: any) => setAttendanceForm(f => ({ ...f, status: v }))}>
                                <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 focus:ring-primary/20 font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-muted-foreground/20">
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="on_leave">On Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Notes</Label>
                            <Input
                                value={attendanceForm.notes}
                                onChange={e => setAttendanceForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Add any notes here..."
                                className="rounded-xl border-muted-foreground/20 h-11 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAttendanceDialogOpen(false)} className="rounded-xl hover:bg-muted/20">Cancel</Button>
                        <Button
                            disabled={!attendanceForm.employee_id || markAttendanceMutation.isPending}
                            onClick={handleMarkAttendance}
                            className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-8 shadow-lg shadow-primary/20"
                        >
                            {markAttendanceMutation.isPending ? "Processing..." : "Mark Attendance"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
