import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    LayoutGrid, BarChart3, AlertTriangle, Plus,
    User, Briefcase, TrendingUp, TrendingDown, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    useEmployeeCapacities,
    useResourceAllocations,
    useAllocateResource,
    useDeallocateResource,
    EmployeeCapacity,
} from "@/hooks/useResourcePlanning";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ResourcePlanningTab() {
    const { data: capacities = [], isLoading: capacitiesLoading } = useEmployeeCapacities();
    const { data: allocations = [], isLoading: allocationsLoading } = useResourceAllocations();
    const allocateResource = useAllocateResource();
    const deallocateResource = useDeallocateResource();

    const [searchTerm, setSearchTerm] = useState("");
    const [allocDialogOpen, setAllocDialogOpen] = useState(false);
    const [allocForm, setAllocForm] = useState({
        employee_id: "",
        project_id: "",
        allocated_hours_per_week: "8",
        start_date: new Date().toISOString().split("T")[0],
    });

    // Fetch projects for allocation form
    const { data: projects = [] } = useQuery({
        queryKey: ["projects-list"],
        queryFn: async () => {
            const { data, error } = await (supabase.from("projects" as any) as any)
                .select("id, title, status")
                .order("created_at", { ascending: false });
            return error ? [] : (data || []);
        },
    });

    const filteredCapacities = useMemo(() => {
        return capacities.filter(c =>
            c.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.department?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [capacities, searchTerm]);

    // Stats
    const stats = useMemo(() => {
        const total = capacities.length;
        const overloaded = capacities.filter(c => c.level === "overloaded").length;
        const underutilized = capacities.filter(c => c.level === "underutilized").length;
        const optimal = capacities.filter(c => c.level === "optimal").length;
        const avgUtilization = total > 0
            ? Math.round(capacities.reduce((s, c) => s + c.utilizationPercent, 0) / total)
            : 0;
        return { total, overloaded, underutilized, optimal, avgUtilization };
    }, [capacities]);

    const handleAllocate = () => {
        allocateResource.mutate({
            employee_id: allocForm.employee_id,
            project_id: allocForm.project_id,
            allocated_hours_per_week: parseFloat(allocForm.allocated_hours_per_week),
            start_date: allocForm.start_date,
        });
        setAllocDialogOpen(false);
        setAllocForm({
            employee_id: "",
            project_id: "",
            allocated_hours_per_week: "8",
            start_date: new Date().toISOString().split("T")[0],
        });
    };

    const levelColors: Record<string, string> = {
        underutilized: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        optimal: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        high_load: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        overloaded: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    };

    const levelLabels: Record<string, string> = {
        underutilized: "Under-utilized",
        optimal: "Optimal",
        high_load: "High Load",
        overloaded: "Overloaded",
    };

    const getUtilizationBarColor = (pct: number) => {
        if (pct >= 100) return "bg-rose-500";
        if (pct >= 85) return "bg-amber-500";
        if (pct >= 50) return "bg-emerald-500";
        return "bg-blue-400";
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <LayoutGrid className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg font-montserrat tracking-tight">Resource Planning</h3>
                        <p className="text-xs text-muted-foreground font-medium">
                            Employee capacity management and project allocation
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setAllocDialogOpen(true)}
                    className="gap-2 bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> Allocate Resource
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: "Total Workforce", value: stats.total, icon: User, color: "text-primary bg-primary/10" },
                    { label: "Avg Utilization", value: `${stats.avgUtilization}%`, icon: BarChart3, color: "text-violet-500 bg-violet-500/10" },
                    { label: "Optimal", value: stats.optimal, icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
                    { label: "High Load", value: stats.overloaded, icon: AlertTriangle, color: "text-rose-500 bg-rose-500/10" },
                    { label: "Under-utilized", value: stats.underutilized, icon: TrendingDown, color: "text-blue-500 bg-blue-500/10" },
                ].map((card, i) => (
                    <Card key={i} className="border-none shadow-sm animate-stagger-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", card.color)}>
                                    <card.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{card.value}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">{card.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search employees or departments..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-xl border-border/50"
                />
            </div>

            {/* Capacity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCapacities.map((emp, i) => (
                    <Card
                        key={emp.employee_id}
                        className={cn(
                            "border shadow-sm transition-all hover:shadow-md animate-stagger-fade-in",
                            emp.level === "overloaded" ? "border-rose-500/30" : "border-border/50"
                        )}
                        style={{ animationDelay: `${i * 30}ms` }}
                    >
                        <CardContent className="p-4 space-y-4">
                            {/* Employee Info */}
                            <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9 ring-2 ring-border/50">
                                    <AvatarImage src={emp.employee_avatar || ""} />
                                    <AvatarFallback className="text-[10px] font-bold">{emp.employee_name?.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{emp.employee_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{emp.department || "Unassigned"}</p>
                                </div>
                                <Badge variant="secondary" className={cn("text-[9px] font-bold h-5 border", levelColors[emp.level])}>
                                    {levelLabels[emp.level]}
                                </Badge>
                            </div>

                            {/* Utilization Bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-muted-foreground">Utilization</span>
                                    <span className={emp.utilizationPercent > 100 ? "text-rose-500" : "text-foreground"}>
                                        {emp.allocatedHours}h / {emp.totalCapacityHours}h ({emp.utilizationPercent}%)
                                    </span>
                                </div>
                                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-500", getUtilizationBarColor(emp.utilizationPercent))}
                                        style={{ width: `${Math.min(emp.utilizationPercent, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Allocations */}
                            {emp.allocations.length > 0 && (
                                <div className="space-y-1.5">
                                    {emp.allocations.map(alloc => (
                                        <div key={alloc.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-xl group">
                                            <div className="flex items-center gap-2">
                                                <Briefcase className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-[11px] font-semibold truncate max-w-[140px]">{alloc.project_title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground">{alloc.allocated_hours_per_week}h/wk</span>
                                                <button
                                                    onClick={() => deallocateResource.mutate(alloc.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-[9px] text-rose-500 hover:bg-rose-500/10 px-1.5 py-0.5 rounded transition-all"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Remaining Capacity */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                <span className="text-[10px] text-muted-foreground font-medium">Available</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    emp.remainingHours > 0 ? "text-emerald-500" : "text-rose-500"
                                )}>
                                    {Math.max(emp.remainingHours, 0)}h/wk
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredCapacities.length === 0 && !capacitiesLoading && (
                <div className="py-16 text-center text-muted-foreground text-sm italic">
                    No workforce data available. Employees will appear here once roles are assigned.
                </div>
            )}

            {/* Allocation Dialog */}
            <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Allocate Resource</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">
                            Assign an employee to a project with weekly hours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Employee</Label>
                            <Select value={allocForm.employee_id} onValueChange={v => setAllocForm(f => ({ ...f, employee_id: v }))}>
                                <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 text-xs font-bold"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent className="rounded-xl max-h-60">
                                    {capacities.map(e => (
                                        <SelectItem key={e.employee_id} value={e.employee_id}>
                                            {e.employee_name} ({e.remainingHours}h available)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Project</Label>
                            <Select value={allocForm.project_id} onValueChange={v => setAllocForm(f => ({ ...f, project_id: v }))}>
                                <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 text-xs font-bold"><SelectValue placeholder="Select project" /></SelectTrigger>
                                <SelectContent className="rounded-xl max-h-60">
                                    {projects.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Hours per Week</Label>
                            <Input
                                type="number"
                                min={1}
                                max={40}
                                value={allocForm.allocated_hours_per_week}
                                onChange={e => setAllocForm(f => ({ ...f, allocated_hours_per_week: e.target.value }))}
                                className="rounded-xl border-muted-foreground/20 h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Start Date</Label>
                            <Input
                                type="date"
                                value={allocForm.start_date}
                                onChange={e => setAllocForm(f => ({ ...f, start_date: e.target.value }))}
                                className="rounded-xl border-muted-foreground/20 h-11"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAllocDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            disabled={!allocForm.employee_id || !allocForm.project_id || allocateResource.isPending}
                            onClick={handleAllocate}
                            className="rounded-xl bg-primary hover:bg-primary/95 font-bold px-8 shadow-lg shadow-primary/20"
                        >
                            {allocateResource.isPending ? "Allocating..." : "Allocate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
