import { useState } from "react";
import { FileText, CheckCircle, XCircle, Clock, Download, CheckSquare, Square } from "lucide-react";
import { exportToCSV, formatLeavesForExport } from "@/utils/exportUtils";
import { useBulkApproveLeaves } from "@/hooks/useLeaveRequests";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { LeaveRequest } from "@/hooks/useLeaveRequests";

interface LeaveTabProps {
    leaveData: {
        requests: LeaveRequest[];
        pendingCount: number;
    } | undefined;
    isStaff: boolean;
    submitLeaveMutation: {
        mutate: (data: { leave_type: LeaveRequest["leave_type"]; start_date: string; end_date: string; reason?: string }) => void;
        isPending: boolean
    };
    approveRejectLeaveMutation: {
        mutate: (data: { id: string; action: "approved" | "rejected" }) => void;
        isPending: boolean
    };
}

export function LeaveTab({
    leaveData,
    isStaff,
    submitLeaveMutation,
    approveRejectLeaveMutation
}: LeaveTabProps) {
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [leaveForm, setLeaveForm] = useState({
        leave_type: "annual" as "annual" | "sick" | "maternity" | "unpaid",
        start_date: "",
        end_date: "",
        reason: ""
    });
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const bulkApproveMutation = useBulkApproveLeaves();

    const handleSubmitLeave = () => {
        submitLeaveMutation.mutate(leaveForm);
        setLeaveDialogOpen(false);
        setLeaveForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
    };

    const handleExport = () => {
        if (leaveData?.requests) {
            const formatted = formatLeavesForExport(leaveData.requests);
            exportToCSV(formatted, "Leave_Requests_Report", Object.keys(formatted[0]));
        }
    };

    const filteredRequests = (leaveData?.requests || []).filter((r: any) =>
        statusFilter === 'all' || r.status === statusFilter
    );

    const pendingRequests = filteredRequests.filter((r: any) => r.status === 'pending');
    const allPendingSelected = pendingRequests.length > 0 && selectedIds.length === pendingRequests.length;

    const toggleSelectAll = () => {
        if (allPendingSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingRequests.map((r: any) => r.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkApprove = () => {
        bulkApproveMutation.mutate(selectedIds, {
            onSuccess: () => setSelectedIds([])
        });
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-foreground">Leave management</h3>
                    {leaveData?.pendingCount > 0 && (
                        <Badge className="bg-amber-500 font-bold animate-pulse-soft">
                            {leaveData?.pendingCount} pending approval
                        </Badge>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {selectedIds.length > 0 && (
                        <Button
                            size="sm"
                            onClick={handleBulkApprove}
                            disabled={bulkApproveMutation.isPending}
                            className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl px-4 animate-scale-in"
                        >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Approve selected ({selectedIds.length})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 sm:flex-none gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5 text-xs font-bold px-4">
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </Button>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-32 rounded-xl h-9 text-xs font-bold border-muted-foreground/20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Logs</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => setLeaveDialogOpen(true)} className="flex-1 sm:flex-none gap-2 bg-primary hover:bg-primary/95 text-xs font-bold rounded-xl px-4">
                        <FileText className="w-3.5 h-3.5" />
                        Submit leave request
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden animate-slide-up">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground">
                                    {isStaff && (
                                        <th className="px-6 py-4 w-10">
                                            <Checkbox
                                                checked={allPendingSelected}
                                                onCheckedChange={toggleSelectAll}
                                                className="border-muted-foreground/30"
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Leave type</th>
                                    <th className="px-6 py-4">Duration</th>
                                    <th className="px-6 py-4">Status</th>
                                    {isStaff && <th className="px-6 py-4 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredRequests.map((req: any, i: number) => (
                                    <tr key={req.id} className={cn("hover:bg-muted/10 transition-colors group", selectedIds.includes(req.id) && "bg-primary/5")}>
                                        {isStaff && (
                                            <td className="px-6 py-4">
                                                {req.status === 'pending' ? (
                                                    <Checkbox
                                                        checked={selectedIds.includes(req.id)}
                                                        onCheckedChange={() => toggleSelect(req.id)}
                                                        className="border-muted-foreground/30"
                                                    />
                                                ) : (
                                                    <div className="w-4 h-4" />
                                                )}
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm text-foreground">{req.employee_name}</div>
                                            <div className="text-[10px] text-muted-foreground font-medium">{req.reason || "No reason provided"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="text-[9px] font-bold border-muted-foreground/30 text-muted-foreground">
                                                {req.leave_type}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                {req.start_date} → {req.end_date}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className={cn("text-[9px] font-bold tracking-tight",
                                                req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    req.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                                            )}>
                                                {req.status}
                                            </Badge>
                                        </td>
                                        {isStaff && (
                                            <td className="px-6 py-4 text-right">
                                                {req.status === 'pending' ? (
                                                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 rounded-lg text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-[10px] font-black"
                                                            onClick={() => approveRejectLeaveMutation.mutate({ id: req.id, action: 'approved' })}
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 rounded-lg text-rose-500 border-rose-500/20 hover:bg-rose-500/10 text-[10px] font-bold"
                                                            onClick={() => approveRejectLeaveMutation.mutate({ id: req.id, action: 'rejected' })}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" />
                                                            Reject
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground font-bold italic opacity-40">Processed</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {(!filteredRequests.length) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm italic font-light">
                                            No leave records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Submit leave request</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">Submit your request for leave.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Leave Category</Label>
                            <Select value={leaveForm.leave_type} onValueChange={(v: any) => setLeaveForm(f => ({ ...f, leave_type: v }))}>
                                <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 focus:ring-primary/20 font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-muted-foreground/20">
                                    <SelectItem value="annual">Annual Leave</SelectItem>
                                    <SelectItem value="sick">Sick Leave</SelectItem>
                                    <SelectItem value="maternity">Maternity/Paternity</SelectItem>
                                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Start Date</Label>
                                <Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} className="rounded-xl border-muted-foreground/20 h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">End Date</Label>
                                <Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} className="rounded-xl border-muted-foreground/20 h-11" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Reason for Leave</Label>
                            <Textarea
                                value={leaveForm.reason}
                                onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                                placeholder="Please provide a reason for your leave request..."
                                rows={3}
                                className="rounded-xl border-muted-foreground/20 focus:ring-primary/20 min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setLeaveDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            disabled={!leaveForm.start_date || !leaveForm.end_date || submitLeaveMutation.isPending}
                            onClick={handleSubmitLeave}
                            className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-8 shadow-lg shadow-primary/20"
                        >
                            {submitLeaveMutation.isPending ? "Submitting..." : "Submit request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
