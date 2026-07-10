import { useState, useMemo } from "react";
import { History, Briefcase, Zap, AlertTriangle, LogOut, TrendingUp, Users, UserPlus, Award } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EmployeeHistoryEvent } from "@/hooks/useEmployeeLifecycle";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";


interface LifecycleTabProps {
    lifecycleData: EmployeeHistoryEvent[];
    isStaff: boolean;
    employees: EmployeeKPI[];
    logLifecycleEventMutation: {
        mutate: (data: { employee_id: string; event_type: EmployeeHistoryEvent["event_type"]; notes?: string; previous_data?: any; new_data?: any }) => void;
        isPending: boolean
    };
}

export function LifecycleTab({
    lifecycleData,
    isStaff,
    employees,
    logLifecycleEventMutation
}: LifecycleTabProps) {
    const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    const [lifecycleForm, setLifecycleForm] = useState({
        employee_id: "",
        event_type: "promotion" as "hire" | "transfer" | "promotion" | "disciplinary" | "offboard",
        notes: ""
    });

    const handleLogEvent = () => {
        logLifecycleEventMutation.mutate(lifecycleForm);
        setLifecycleDialogOpen(false);
        setLifecycleForm({
            employee_id: "",
            event_type: "promotion",
            notes: ""
        });
    };

    const filteredLifecycle = useMemo(() => {
        if (!selectedEmpId) return lifecycleData;
        return lifecycleData.filter(h => h.employee_id === selectedEmpId);
    }, [lifecycleData, selectedEmpId]);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'hire': return <UserPlus className="w-4 h-4" />;
            case 'promotion': return <Award className="w-4 h-4" />;
            case 'transfer': return <TrendingUp className="w-4 h-4" />;
            case 'disciplinary': return <AlertTriangle className="w-4 h-4" />;
            case 'offboard': return <LogOut className="w-4 h-4" />;
            default: return <History className="w-4 h-4" />;
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'hire': return 'bg-emerald-500 shadow-emerald-500/30';
            case 'promotion': return 'bg-amber-500 shadow-amber-500/30';
            case 'transfer': return 'bg-blue-500 shadow-blue-500/30';
            case 'disciplinary': return 'bg-rose-500 shadow-rose-500/30';
            case 'offboard': return 'bg-slate-500 shadow-slate-500/30';
            default: return 'bg-slate-500 shadow-slate-500/30';
        }
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'hire': return 'Hire';
            case 'promotion': return 'Promotion';
            case 'transfer': return 'Transfer';
            case 'disciplinary': return 'Disciplinary';
            case 'offboard': return 'Offboarding';
            default: return 'General Event';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-foreground">Employee timeline</h3>
                    <Select value={selectedEmpId || "all"} onValueChange={v => setSelectedEmpId(v === "all" ? null : v)}>
                        <SelectTrigger className="w-56 rounded-xl border-primary/20 bg-primary/5 font-medium h-9 text-xs">
                            <SelectValue placeholder="Filter by employee" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All employees</SelectItem>
                            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {isStaff && (
                    <Button size="sm" onClick={() => setLifecycleDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/95 text-xs font-bold rounded-xl shadow-lg shadow-primary/20">
                        <History className="w-4 h-4" />
                        Log event
                    </Button>
                )}
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm border border-border/20 p-8">
                <div className="relative space-y-8">
                    {/* Vertical Line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/20 via-primary/40 to-primary/20" />

                    {filteredLifecycle.map((event, i) => (
                        <div key={event.id} className="relative pl-12 group animate-stagger-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                            {/* Dot */}
                            <div className={cn(
                                "absolute left-0 top-1 w-10 h-10 rounded-2xl flex items-center justify-center text-white z-10 transition-transform group-hover:scale-110 shadow-lg",
                                getEventColor(event.event_type)
                            )}>
                                {getEventIcon(event.event_type)}
                            </div>

                            <div className="bg-card/60 backdrop-blur-sm border border-border/40 p-5 rounded-[24px] shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                                    <div>
                                        <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary mb-1">
                                            {getEventLabel(event.event_type)}
                                        </Badge>
                                        <h4 className="text-sm font-bold text-foreground">{event.employee_name}</h4>
                                    </div>
                                    <p className="text-[10px] font-medium text-muted-foreground">{new Date(event.effective_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <p className="text-xs font-medium text-muted-foreground leading-relaxed">{event.notes || "Employee event recorded."}</p>
                            </div>
                        </div>
                    ))}

                    {filteredLifecycle.length === 0 && (
                        <div className="text-center py-20">
                            <History className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">No lifecycle events found.</p>
                        </div>
                    )}
                </div>
            </Card>

            <Dialog open={lifecycleDialogOpen} onOpenChange={setLifecycleDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-foreground">Log lifecycle event</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">Record a milestone or event for an employee.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Select Employee</Label>
                            <Select value={lifecycleForm.employee_id} onValueChange={v => setLifecycleForm(f => ({ ...f, employee_id: v }))}>
                                <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 focus:ring-primary/20 font-bold text-xs"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName || e.email}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Event Type</Label>
                            <Select value={lifecycleForm.event_type} onValueChange={(v: any) => setLifecycleForm(f => ({ ...f, event_type: v }))}>
                                <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 focus:ring-primary/20 font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="hire">Hire</SelectItem>
                                    <SelectItem value="transfer">Transfer</SelectItem>
                                    <SelectItem value="promotion">Promotion</SelectItem>
                                    <SelectItem value="disciplinary">Disciplinary Action</SelectItem>
                                    <SelectItem value="offboard">Offboarding</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Event Notes</Label>
                            <Textarea
                                value={lifecycleForm.notes}
                                onChange={e => setLifecycleForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Provide additional details..."
                                rows={3}
                                className="rounded-xl min-h-[120px] focus:ring-primary/20 border-muted-foreground/20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setLifecycleDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            disabled={!lifecycleForm.employee_id || logLifecycleEventMutation.isPending}
                            onClick={handleLogEvent}
                            className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-8 shadow-lg shadow-primary/20"
                        >
                            {logLifecycleEventMutation.isPending ? "Logging..." : "Log event"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
