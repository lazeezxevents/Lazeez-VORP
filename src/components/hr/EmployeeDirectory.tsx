import { useState, useMemo } from "react";
import {
    Search, Filter, TrendingUp, Edit, Trash2, UserPlus,
    AlertTriangle, ShieldCheck, TrendingDown, AlignLeft
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";
import { cn } from "@/lib/utils";
import { useDesignations, useManagers } from "@/components/hooks/useUsers";
import { toast } from "sonner";

interface EmployeeDirectoryProps {
    employees: EmployeeKPI[];
    departments: { id: string; name: string }[];
    isAdmin: boolean;
    addEmployeeMutation: { mutate: (data: { full_name: string; email: string; department_id: string }) => void; isPending: boolean };
    updateEmployeeMutation: { mutate: (data: { id: string; full_name: string; department_id: string }) => void; isPending: boolean };
    deleteEmployeeMutation: { mutate: (id: string) => void; isPending: boolean };
    currentUserEmail?: string;
}

export function EmployeeDirectory({
    employees = [],
    departments = [],
    isAdmin,
    addEmployeeMutation,
    updateEmployeeMutation,
    deleteEmployeeMutation,
    currentUserEmail
}: EmployeeDirectoryProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDept, setSelectedDept] = useState("all");

    // Fetch designations and managers
    const { data: designations = [] } = useDesignations();
    const { data: managers = [] } = useManagers();

    // Employee Detail Modal
    const [perfDetailOpen, setPerfDetailOpen] = useState(false);
    const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<any>(null);

    // Management Modals
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

    const [newEmployee, setNewEmployee] = useState({ 
        full_name: "", 
        email: "", 
        department_id: "", 
        designation_id: "", 
        base_role: "employee",
        reporting_manager_id: ""
    });
    const [editEmployeeData, setEditEmployeeData] = useState({ 
        id: "", 
        full_name: "", 
        email: "", 
        department_id: "", 
        designation_id: "", 
        base_role: "employee",
        reporting_manager_id: ""
    });

    const filteredEmployees = useMemo(() => {
        let result = employees;
        if (selectedDept !== "all") {
            const deptName = departments.find(d => d.id === selectedDept)?.name;
            result = result.filter(emp => emp.department === deptName);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(emp =>
                emp.fullName?.toLowerCase().includes(q) ||
                emp.email?.toLowerCase().includes(q) ||
                emp.department?.toLowerCase().includes(q) ||
                emp.designation?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [employees, selectedDept, departments, searchQuery]);

    const handleAddEmployee = () => {
        // Validation
        if (!newEmployee.full_name.trim()) {
            toast.error("Full name is required");
            return;
        }
        if (!newEmployee.email.trim()) {
            toast.error("Email is required");
            return;
        }
        if (!newEmployee.department_id) {
            toast.error("Department is required");
            return;
        }
        
        const deptName = departments.find(d => d.id === newEmployee.department_id)?.name || "Unknown Department";
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        addEmployeeMutation.mutate(newEmployee);
        setAddEmployeeOpen(false);
        
        // Show success toast
        toast.success("Invitation sent successfully!", {
            description: `Successfully sent the invitation to ${newEmployee.full_name} with ${newEmployee.email} email at ${dateStr}, ${timeStr} in ${deptName} department.`,
            duration: 5000,
        });
        
        setNewEmployee({ 
            full_name: "", 
            email: "", 
            department_id: "", 
            designation_id: "", 
            base_role: "employee",
            reporting_manager_id: ""
        });
    };

    const handleUpdateEmployee = () => {
        // Validation
        if (!editEmployeeData.full_name.trim()) {
            toast.error("Full name is required");
            return;
        }
        if (!editEmployeeData.email.trim()) {
            toast.error("Email is required");
            return;
        }
        if (!editEmployeeData.department_id) {
            toast.error("Department is required");
            return;
        }
        
        updateEmployeeMutation.mutate(editEmployeeData);
        setEditEmployeeOpen(false);
        toast.success("Employee updated successfully!");
    };

    const handleDeleteEmployee = () => {
        if (employeeToDelete) {
            deleteEmployeeMutation.mutate(employeeToDelete);
            setDeleteConfirmOpen(false);
            setEmployeeToDelete(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email or department..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rounded-xl h-11 border-muted-foreground/20 focus:ring-primary/20"
                        />
                    </div>
                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                        <SelectTrigger className="w-full sm:w-56 rounded-xl h-11 border-muted-foreground/20 text-xs font-bold">
                            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => setAddEmployeeOpen(true)} className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/95 font-black rounded-xl h-11 shadow-lg shadow-primary/20">
                    <UserPlus className="w-4 h-4" />
                    ADD EMPLOYEE
                </Button>
            </div>

            <Card className="border-none shadow-sm overflow-hidden animate-slide-up">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Designation</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4">Performance Score</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredEmployees.map((emp, i) => (
                                    <tr key={emp.id} className="hover:bg-muted/10 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {emp.avatarUrl ? (
                                                    <img
                                                        src={emp.avatarUrl}
                                                        alt={emp.fullName || "User"}
                                                        className="w-10 h-10 rounded-2xl object-cover border border-primary/10 group-hover:scale-105 transition-transform"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName || emp.email)}&background=random`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/10 group-hover:scale-105 transition-transform font-montserrat">
                                                        {emp.fullName?.charAt(0) || "U"}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black truncate text-foreground leading-tight font-montserrat tracking-tight">{emp.fullName || "Unnamed Employee"}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate font-bold font-poppins">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-foreground">
                                                {emp.designation || "Executive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className="font-extrabold text-[10px] bg-muted/50 text-slate-600 uppercase tracking-tight">
                                                {emp.department || "Unassigned"}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 w-24 bg-muted rounded-full h-2 overflow-hidden shadow-inner ring-1 ring-inset ring-black/5">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-700 rounded-full",
                                                            emp.performanceScore > 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" :
                                                                emp.performanceScore > 50 ? "bg-gradient-to-r from-blue-400 to-blue-600" :
                                                                    "bg-gradient-to-r from-rose-400 to-rose-600"
                                                        )}
                                                        style={{ width: `${emp.performanceScore}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-foreground w-8">{emp.performanceScore}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest",
                                                emp.trend === 'up' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                                                    emp.trend === 'down' ? 'text-rose-600 border-rose-200 bg-rose-50' :
                                                        'text-slate-500 border-slate-200 bg-slate-50'
                                            )}>
                                                {emp.trend === 'up' ? '↑ Rising' : emp.trend === 'down' ? '↓ Declining' : '→ Stable'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg transition-all"
                                                    onClick={() => {
                                                        setSelectedEmployeeDetail(emp);
                                                        setPerfDetailOpen(true);
                                                    }}
                                                >
                                                    <TrendingUp className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-amber-100 hover:text-amber-600 rounded-lg transition-all"
                                                    onClick={() => {
                                                        setEditEmployeeData({
                                                            id: emp.id,
                                                            full_name: emp.fullName || "",
                                                            email: emp.email,
                                                            department_id: departments.find(d => d.name === emp.department)?.id || "",
                                                            designation_id: "", // Will be populated from database
                                                            base_role: "employee", // Default, will be populated from database
                                                            reporting_manager_id: "" // Will be populated from database
                                                        });
                                                        setEditEmployeeOpen(true);
                                                    }}
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </Button>
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                                                        onClick={() => {
                                                            setEmployeeToDelete(emp.id);
                                                            setDeleteConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm italic font-light">
                                            No employees found for the current search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Sub-Dialogs managed internally */}
            <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
                <DialogContent className="bg-background/95 backdrop-blur-xl border-white/20 sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Add New Employee</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium text-xs">
                            Enter the details of the new organizational member. Fields marked with * are required.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Full Name <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    value={newEmployee.full_name}
                                    onChange={e => setNewEmployee(p => ({ ...p, full_name: e.target.value }))}
                                    className="rounded-xl h-11 border-muted-foreground/20"
                                    placeholder="e.g. Alexander Pierce"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Work Email <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    type="email"
                                    value={newEmployee.email}
                                    onChange={e => setNewEmployee(p => ({ ...p, email: e.target.value }))}
                                    className="rounded-xl h-11 border-muted-foreground/20"
                                    placeholder="name@lazeez-events.com"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Department <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={newEmployee.department_id} onValueChange={v => setNewEmployee(p => ({ ...p, department_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Base System Role <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={newEmployee.base_role} onValueChange={v => setNewEmployee(p => ({ ...p, base_role: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                                        <SelectItem value="ops_manager">Manager (Department)</SelectItem>
                                        <SelectItem value="employee">Employee (Standard)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Base access level for system permissions
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Designation (Role with Permissions)
                                </Label>
                                <Select value={newEmployee.designation_id} onValueChange={v => setNewEmployee(p => ({ ...p, designation_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue placeholder="No Designation" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {designations.map(d => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.display_name || d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Optional: Designation from Role & Access feature
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Reporting Manager
                                </Label>
                                <Select value={newEmployee.reporting_manager_id} onValueChange={v => setNewEmployee(p => ({ ...p, reporting_manager_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue placeholder="No Manager" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {managers.map(m => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.full_name || m.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Optional: Select reporting manager
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAddEmployeeOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddEmployee} 
                            disabled={addEmployeeMutation.isPending} 
                            className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-black px-8"
                        >
                            Add Employee
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
                <DialogContent className="bg-background/95 backdrop-blur-xl border-white/20 sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Edit Employee Profile</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium text-xs">
                            Update organizational details for {editEmployeeData.full_name}. Fields marked with * are required.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Full Name <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    value={editEmployeeData.full_name}
                                    onChange={e => setEditEmployeeData(p => ({ ...p, full_name: e.target.value }))}
                                    className="rounded-xl h-11 border-muted-foreground/20"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Work Email <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    type="email"
                                    value={editEmployeeData.email}
                                    onChange={e => setEditEmployeeData(p => ({ ...p, email: e.target.value }))}
                                    className="rounded-xl h-11 border-muted-foreground/20"
                                    placeholder="name@lazeez-events.com"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Department <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={editEmployeeData.department_id} onValueChange={v => setEditEmployeeData(p => ({ ...p, department_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Base System Role <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={editEmployeeData.base_role} onValueChange={v => setEditEmployeeData(p => ({ ...p, base_role: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                                        <SelectItem value="ops_manager">Manager (Department)</SelectItem>
                                        <SelectItem value="employee">Employee (Standard)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Base access level for system permissions
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Designation (Role with Permissions)
                                </Label>
                                <Select value={editEmployeeData.designation_id} onValueChange={v => setEditEmployeeData(p => ({ ...p, designation_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue placeholder="No Designation" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {designations.map(d => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.display_name || d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Optional: Designation from Role & Access feature
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                                    Reporting Manager
                                </Label>
                                <Select value={editEmployeeData.reporting_manager_id} onValueChange={v => setEditEmployeeData(p => ({ ...p, reporting_manager_id: v }))}>
                                    <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 font-bold text-xs">
                                        <SelectValue placeholder="No Manager" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {managers.map(m => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.full_name || m.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Optional: Select reporting manager
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditEmployeeOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleUpdateEmployee} disabled={updateEmployeeMutation.isPending} className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-black px-8">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="bg-background/95 backdrop-blur-xl border-rose-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600 flex items-center gap-2 font-black text-xl">
                            <AlertTriangle className="w-6 h-6" />
                            Confirm Termination
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium text-xs">
                            Are you certain you wish to remove this employee? This action will disable access to the system for this member.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="rounded-xl flex-1 border-muted-foreground/20">Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteEmployee}
                            disabled={deleteEmployeeMutation.isPending}
                            className="rounded-xl flex-1 bg-rose-600 hover:bg-rose-700 font-extrabold"
                        >
                            {deleteEmployeeMutation.isPending ? "Updating..." : "Confirm Termination"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={perfDetailOpen} onOpenChange={setPerfDetailOpen}>
                <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-3xl border-white/20 rounded-[40px] shadow-2xl">
                    {selectedEmployeeDetail && (
                        <div className="p-2">
                            <DialogHeader className="mb-8">
                                <div className="flex items-center gap-5">
                                    {selectedEmployeeDetail.avatarUrl ? (
                                        <img
                                            src={selectedEmployeeDetail.avatarUrl}
                                            alt={selectedEmployeeDetail.fullName}
                                            className="w-16 h-16 rounded-[24px] object-cover shadow-xl shadow-primary/20"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-primary-foreground text-3xl shadow-xl shadow-primary/20">
                                            {selectedEmployeeDetail.fullName?.charAt(0) || "U"}
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <DialogTitle className="text-3xl font-bold tracking-tighter font-montserrat">{selectedEmployeeDetail.fullName}</DialogTitle>
                                        <DialogDescription className="text-muted-foreground text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-primary/60" />
                                            {selectedEmployeeDetail.designation || "Executive"} • {selectedEmployeeDetail.department}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-2">
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Key Performance Metrics</h4>
                                    {[
                                        { label: "Execution Score", score: selectedEmployeeDetail.outputScore, color: "bg-emerald-500", icon: TrendingUp },
                                        { label: "Efficiency Average", score: selectedEmployeeDetail.efficiencyScore, color: "bg-amber-500", icon: AlignLeft },
                                        { label: "Quality Rating", score: selectedEmployeeDetail.qualityScore, color: "bg-rose-500", icon: ShieldCheck },
                                        { label: "Reliability Factor", score: selectedEmployeeDetail.reliabilityScore, color: "bg-indigo-500", icon: AlertTriangle },
                                    ].map((v, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[11px] font-black text-foreground/80 flex items-center gap-1.5 uppercase tracking-tight">
                                                    <v.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {v.label}
                                                </span>
                                                <span className="text-xs font-black">{v.score}%</span>
                                            </div>
                                            <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden ring-1 ring-inset ring-black/5">
                                                <div className={cn("h-full rounded-full transition-all duration-1000", v.color)} style={{ width: `${v.score}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2 gap-3 pt-4">
                                        <div className="p-4 bg-muted/30 rounded-[20px] border border-white/40 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Tasks Completed</p>
                                            <p className="text-xl font-black text-foreground">{selectedEmployeeDetail.tasksCompleted}/{selectedEmployeeDetail.totalTasksAssigned}</p>
                                        </div>
                                        <div className="p-4 bg-muted/30 rounded-[20px] border border-white/40 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Efficiency Avg</p>
                                            <p className="text-xl font-black text-foreground">{selectedEmployeeDetail.avgEfficiency}%</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary/[0.03] rounded-[32px] p-8 border-2 border-primary/5 shadow-inner flex flex-col items-center justify-center space-y-8">
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase tracking-widest font-black text-primary opacity-40 mb-1">Performance Overview</p>
                                        <p className="text-xs font-bold text-muted-foreground/60 text-center">Standard Performance Score</p>
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                                        <svg className="w-40 h-40 transform -rotate-90 relative z-10">
                                            <circle
                                                cx="80" cy="80" r="74"
                                                stroke="currentColor"
                                                strokeWidth="10"
                                                fill="transparent"
                                                className="text-muted/10"
                                            />
                                            <circle
                                                cx="80" cy="80" r="74"
                                                stroke="currentColor"
                                                strokeWidth="10"
                                                fill="transparent"
                                                strokeDasharray={465}
                                                strokeDashoffset={465 - (465 * selectedEmployeeDetail.performanceScore) / 100}
                                                strokeLinecap="round"
                                                className="text-primary transition-all duration-1000"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                            <span className="text-5xl font-black tracking-tighter">{selectedEmployeeDetail.performanceScore}%</span>
                                        </div>
                                    </div>

                                    <Badge className={cn(
                                        "px-6 py-2.5 rounded-[12px] font-black text-[11px] tracking-widest shadow-xl transition-all",
                                        selectedEmployeeDetail.performanceScore > 80 ? "bg-emerald-500 shadow-emerald-500/20" :
                                            selectedEmployeeDetail.performanceScore > 50 ? "bg-blue-500 shadow-blue-500/20" : "bg-rose-500 shadow-rose-500/20"
                                    )}>
                                        {selectedEmployeeDetail.performanceScore > 80 ? "EXCELLENT" :
                                            selectedEmployeeDetail.performanceScore > 50 ? "AVERAGE" : "NEEDS IMPROVEMENT"}
                                    </Badge>
                                </div>
                            </div>
                            <DialogFooter className="mt-8">
                                <Button onClick={() => setPerfDetailOpen(false)} className="rounded-2xl h-12 px-10 font-black shadow-lg shadow-black/5 hover:scale-[1.02] active:scale-[0.98] transition-all">Close</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
