import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
import {
    Building2,
    TrendingUp,
    Award,
    Clock,
    UserCheck,
    Users,
    ChevronRight,
    UserPlus,
    FileText,
    ClipboardCheck,
    History,
    Settings as SettingsIcon,
    Shield,
    Tag,
    AlertTriangle,
    Timer,
    Eye,
    LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { useEmployeePerformance } from "@/hooks/useEmployeePerformance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { VendorAssignment } from "@/components/settings/VendorAssignment";
import { DesignationManagement } from "@/components/settings/DesignationManagement";
import { CustomRoleManager } from "@/components/settings/CustomRoleManager";
import { useDepartments, useBusinessUnits } from "@/hooks/useUsers";
import { useAttendanceLogs, useMarkAttendance } from "@/hooks/useAttendance";
import { useLeaveRequests, useSubmitLeave, useApproveRejectLeave } from "@/hooks/useLeaveRequests";
import { useAppraisalReviews, useSubmitReview } from "@/hooks/useAppraisals";
import { useEmployeeHistory, useLogLifecycleEvent } from "@/hooks/useEmployeeLifecycle";

// Modular Components
import { KPIStats } from "@/components/hr/KPIStats";
import { DepartmentCards } from "@/components/hr/DepartmentCards";
import { DashboardTab } from "@/components/hr/DashboardTab";
import { PerformanceTab } from "@/components/hr/PerformanceTab";
import { EmployeeDirectory } from "@/components/hr/EmployeeDirectory";
import { AttendanceTab } from "@/components/hr/AttendanceTab";
import { LeaveTab } from "@/components/hr/LeaveTab";
import { AppraisalsTab } from "@/components/hr/AppraisalsTab";
import { LifecycleTab } from "@/components/hr/LifecycleTab";
import { OrgChartTab } from "@/components/hr/OrgChartTab";
import { EmployeeIntelligenceProfile } from "@/components/hr/EmployeeIntelligenceProfile";
import { TimeTrackingPanel } from "@/components/hr/TimeTrackingPanel";
import { AuditLogAssignmentBoard } from "@/components/hr/AuditLogAssignmentBoard";
import { ResourcePlanningTab } from "@/components/hr/ResourcePlanningTab";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";

export default function HRPerformance() {
    const { user, isAdmin, hasPermission, isHR, isManager: isAuthManager, isStaff: isAuthStaff } = useAuth();
    const { data: departmentsData = [], isLoading: isDeptsLoading } = useDepartments();
    const managedDepartment = departmentsData.find(d => d.manager_id === user?.id);
    const isDeptManager = !!managedDepartment;
    const isManager = isAuthManager || isDeptManager;
    const isStaff = isAuthStaff || isManager || isHR;
    const departments = departmentsData;

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const defaultTab = searchParams.get("tab") || "overview";
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(searchParams.get("deptId"));

    // Intelligence Profile State
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeKPI | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);

    const handleEmployeeClick = (employee: EmployeeKPI) => {
        setSelectedEmployee(employee);
        setProfileOpen(true);
    };

    // Auto-select managed department for managers if no selection exists
    useEffect(() => {
        if (!selectedDeptId && managedDepartment && !searchParams.get("deptId")) {
            handleDeptSelect(managedDepartment.id);
        }
    }, [managedDepartment]);
    const { data: perfData, isLoading: isPerfLoading } = useEmployeePerformance();

    const { data: bUnits = [] } = useBusinessUnits();
    const [selectedBUId, setSelectedBUId] = useState<string | null>(null);

    // Sync state with URL
    useEffect(() => {
        const tabFromUrl = searchParams.get("tab");
        if (tabFromUrl && tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
        const deptIdFromUrl = searchParams.get("deptId");
        if (deptIdFromUrl !== selectedDeptId) setSelectedDeptId(deptIdFromUrl);
    }, [searchParams]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params: Record<string, string> = { tab: value };
        if (selectedDeptId) params.deptId = selectedDeptId;
        setSearchParams(params);
    };

    const handleDeptSelect = (deptId: string | null) => {
        setSelectedDeptId(deptId);
        const params: Record<string, string> = { tab: activeTab };
        if (deptId) params.deptId = deptId;
        setSearchParams(params);
    };

    // Sub-data fetching
    const { data: recentActivity = [] } = useQuery({
        queryKey: ["hr-performance-logs"],
        queryFn: async () => {
            const { data, error } = await supabase.from("performance_logs").select("*, profiles(full_name, email)").order("logged_at", { ascending: false }).limit(6);
            return error ? [] : (data || []);
        }
    });

    const queryClient = useQueryClient();
    const [manageDeptsOpen, setManageDeptsOpen] = useState(false);
    const [newDeptName, setNewDeptName] = useState("");

    // Mutations from original logic
    const addDeptMutation = useMutation({
        mutationFn: async (name: string) => {
            const { data, error } = await supabase.from("departments").insert({ name }).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["departments"] });
            toast.success("Department created");
            setNewDeptName("");
        }
    });

    const addEmployeeMutation = useMutation({
        mutationFn: async (data: { full_name: string; email: string; department_id: string }) => {
            const { data: profile, error: pError } = await supabase.from("profiles").insert({
                full_name: data.full_name,
                email: data.email,
                department_id: data.department_id,
                id: crypto.randomUUID()
            }).select().single();
            if (pError) throw pError;
            const { error: rError } = await supabase.from("user_roles").insert({ user_id: profile.id, role: "employee" });
            if (rError) throw rError;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employee-performance"] }); toast.success("Employee onboarded"); },
        onError: (err: { message: string }) => toast.error(err.message)
    });

    const updateEmployeeMutation = useMutation({
        mutationFn: async (data: { id: string; full_name: string; department_id: string }) => {
            const { error } = await supabase.from("profiles").update({ full_name: data.full_name, department_id: data.department_id }).eq("id", data.id);
            if (error) throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employee-performance"] }); toast.success("Employee updated"); },
        onError: (err: { message: string }) => toast.error(err.message)
    });

    const deleteEmployeeMutation = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from("user_roles").delete().eq("user_id", id);
            const { error } = await supabase.from("profiles").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employee-performance"] }); toast.success("Employee removed"); },
        onError: (err: { message: string }) => toast.error(err.message)
    });

    // Sub-hooks for features
    const { data: attendanceData } = useAttendanceLogs(selectedDeptId);
    const markAttendance = useMarkAttendance();
    const { data: leaveData } = useLeaveRequests();
    const submitLeave = useSubmitLeave();
    const approveRejectLeave = useApproveRejectLeave();
    const { data: appraisalData = [] } = useAppraisalReviews();
    const submitReview = useSubmitReview();
    const { data: lifecycleData = [] } = useEmployeeHistory();
    const logLifecycleEvent = useLogLifecycleEvent();

    // Stats Calculation
    const employees = perfData?.employees || [];
    const filteredEmployees = useMemo(() => {
        if (selectedDeptId) {
            const deptName = departments.find(d => d.id === selectedDeptId)?.name;
            return employees.filter(e => e.department === deptName);
        }
        if (selectedBUId) {
            return employees.filter(e => e.businessUnitId === selectedBUId);
        }
        return employees;
    }, [employees, selectedDeptId, selectedBUId, departments]);

    const stats = useMemo(() => ({
        totalEmployees: filteredEmployees.length,
        avgPerformance: filteredEmployees.length > 0 ? Math.round(filteredEmployees.reduce((s, e) => s + e.performanceScore, 0) / filteredEmployees.length) : 0,
        avgOutput: filteredEmployees.length > 0 ? Math.round(filteredEmployees.reduce((s, e) => s + e.outputScore, 0) / filteredEmployees.length) : 0,
        avgEfficiency: filteredEmployees.length > 0 ? Math.round(filteredEmployees.reduce((s, e) => s + e.avgEfficiency, 0) / filteredEmployees.length) : 0,
        avgQuality: filteredEmployees.length > 0 ? Math.round(filteredEmployees.reduce((s, e) => s + e.qualityScore, 0) / filteredEmployees.length) : 0,
        avgReliability: filteredEmployees.length > 0 ? Math.round(filteredEmployees.reduce((s, e) => s + e.reliabilityScore, 0) / filteredEmployees.length) : 0,
    }), [filteredEmployees]);

    const deptStatsData = useMemo(() => {
        return departments.map(dept => {
            const deptEmps = employees.filter(e => e.department === dept.name);
            const avg = (fn: (e: EmployeeKPI) => number) =>
                deptEmps.length > 0 ? Math.round(deptEmps.reduce((s, e) => s + fn(e), 0) / deptEmps.length) : 0;

            return {
                id: dept.id,
                name: dept.name,
                performance: avg(e => e.performanceScore),
                output: avg(e => e.outputScore),
                efficiency: avg(e => e.efficiencyScore),
                quality: avg(e => e.qualityScore),
                reliability: avg(e => e.reliabilityScore),
                employees: deptEmps.length,
            };
        });
    }, [departments, employees]);

    const perfDistribution = useMemo(() => {
        const ranges = [
            { name: "Excellent (80-100)", min: 80, max: 100, fill: "#10b981" },
            { name: "Good (60-79)", min: 60, max: 79, fill: "#3b82f6" },
            { name: "Average (40-59)", min: 40, max: 59, fill: "#f59e0b" },
            { name: "Needs Work (0-39)", min: 0, max: 39, fill: "#ef4444" },
        ];
        return ranges.map(r => ({
            ...r,
            value: employees.filter(e => e.performanceScore >= r.min && e.performanceScore <= r.max).length,
        })).filter(r => r.value > 0);
    }, [employees]);

    if (isPerfLoading || isDeptsLoading) {
        return <DashboardLayout><div className="h-screen flex items-center justify-center"><Clock className="animate-spin w-8 h-8 text-primary" /></div></DashboardLayout>;
    }

    // Top-level guard: Employees cannot access HR Intelligence directly
    if (!isStaff && !isAdmin) {
        return (
            <DashboardLayout title="Access Restricted">
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="p-6 bg-rose-500/10 rounded-full">
                        <Shield className="w-12 h-12 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold font-montserrat tracking-tight text-slate-900">Permission Required</h2>
                    <p className="text-slate-500 font-medium max-w-sm text-center">
                        The Workforce Intelligence System is reserved for Leadership, HR, and Management teams.
                    </p>
                    <Button onClick={() => navigate("/dashboard")} variant="outline" className="rounded-xl">
                        Return to Dashboard
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    const deptMatch = selectedDeptId ? deptStatsData.find(d => d.id === selectedDeptId) : null;

    return (
        <DashboardLayout
            title={selectedDeptId ? departments.find(d => d.id === selectedDeptId)?.name : "HR / Performance"}
            subtitle={selectedDeptId ? "View detailed metrics and employee directory." : "Workforce analytics, performance tracking and management."}
        >
            <div className="space-y-6 sm:space-y-8 animate-fade-in pb-20">



                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <div className="bg-muted/30 p-1.5 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
                        <TabsList className="bg-transparent h-auto gap-1">
                            {[
                                { value: "overview", icon: TrendingUp, label: "Overview", permission: "hr.view" },
                                { value: "performance", icon: Award, label: "Performance", permission: "hr.view" },
                                { value: "departments", icon: Building2, label: "Departments", permission: "hr.manage" },
                                { value: "employees", icon: Users, label: "Directory", permission: "hr.manage" },
                                { value: "attendance", icon: Clock, label: "Attendance", permission: "hr.view" },
                                { value: "leave", icon: FileText, label: "Leave", permission: "hr.view" },
                                { value: "appraisals", icon: ClipboardCheck, label: "Appraisals", permission: "hr.view" },
                                { value: "lifecycle", icon: History, label: "Lifecycle", permission: "hr.manage" },
                                { value: "orgchart", icon: UserCheck, label: "Org Chart", permission: "hr.view" },
                                { value: "timetracking", icon: Timer, label: "Time Tracking", permission: "hr.view" },
                                { value: "auditassign", icon: Eye, label: "Audit Access", permission: "hr.manage" },
                                { value: "resources", icon: LayoutGrid, label: "Resources", permission: "hr.manage" },
                            ]
                                .filter(tab => {
                                    // Regular staff check
                                    if (!isStaff && !isAdmin) return false;
                                    
                                    // Specific restrictions: Departments and Directories only for HR or Admin
                                    if ((tab.value === "departments" || tab.value === "employees" || tab.value === "lifecycle") && !isHR && !isAdmin) {
                                        return false;
                                    }

                                    return hasPermission(tab.permission as any);
                                })
                                .map(tab => (
                                    <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight">
                                        <tab.icon className="w-4 h-4" /> {tab.label}
                                    </TabsTrigger>
                                ))}
                            {hasPermission("users.manage") && (
                                <>
                                    <TabsTrigger value="assignments" className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-semibold text-xs tracking-tight">
                                        <UserCheck className="w-4 h-4" /> Assignments
                                    </TabsTrigger>
                                    <TabsTrigger value="roles" className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary font-semibold text-xs tracking-tight">
                                        <SettingsIcon className="w-4 h-4" /> Roles
                                    </TabsTrigger>
                                </>
                            )}
                        </TabsList>
                    </div>

                    <div className="mb-8">
                        <KPIStats
                            totalEmployees={selectedDeptId ? employees.filter(e => e.department === deptMatch?.name).length : stats.totalEmployees}
                            avgPerformance={deptMatch?.performance ?? stats.avgPerformance}
                            avgOutput={deptMatch?.output ?? stats.avgOutput}
                            avgEfficiency={deptMatch?.efficiency ?? stats.avgEfficiency}
                            avgQuality={deptMatch?.quality ?? stats.avgQuality}
                            avgReliability={deptMatch?.reliability ?? stats.avgReliability}
                        />
                    </div>

                    <TabsContent value="overview" className="focus-visible:outline-none">
                        <DashboardTab
                            deptPerformanceData={deptStatsData.filter(d => d.performance > 0)}
                            perfDistribution={perfDistribution}
                            recentActivity={recentActivity}
                            totalEmployees={stats.totalEmployees}
                            avgPerformance={stats.avgPerformance}
                        />
                    </TabsContent>
                    <TabsContent value="performance" className="focus-visible:outline-none"><PerformanceTab deptPerformanceData={deptStatsData.filter(d => d.performance > 0)} perfDistribution={perfDistribution} /></TabsContent>
                    <TabsContent value="departments" className="focus-visible:outline-none space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800 font-montserrat tracking-tight">Department management</h2>
                            <Button onClick={() => setManageDeptsOpen(true)} className="rounded-xl h-10 px-4 gap-2 font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/95" size="sm">
                                <Building2 className="w-4 h-4" /> Restructure
                            </Button>
                        </div>
                        <DepartmentCards
                            departments={deptStatsData}
                            onDeptSelect={handleDeptSelect}
                        />
                    </TabsContent>
                    <TabsContent value="employees" className="focus-visible:outline-none"><EmployeeDirectory employees={employees} departments={departments} isAdmin={isAdmin} addEmployeeMutation={addEmployeeMutation} updateEmployeeMutation={updateEmployeeMutation} deleteEmployeeMutation={deleteEmployeeMutation} currentUserEmail={user?.email} /></TabsContent>
                    <TabsContent value="attendance" className="focus-visible:outline-none"><AttendanceTab attendanceData={attendanceData} isStaff={isStaff} employees={employees} markAttendanceMutation={markAttendance} /></TabsContent>
                    <TabsContent value="leave" className="focus-visible:outline-none"><LeaveTab leaveData={leaveData} isStaff={isStaff} submitLeaveMutation={submitLeave} approveRejectLeaveMutation={approveRejectLeave} /></TabsContent>
                    <TabsContent value="appraisals" className="focus-visible:outline-none"><AppraisalsTab appraisalData={appraisalData} employees={employees} submitReviewMutation={submitReview} /></TabsContent>
                    <TabsContent value="lifecycle" className="focus-visible:outline-none"><LifecycleTab lifecycleData={lifecycleData} isStaff={isStaff} employees={employees} logLifecycleEventMutation={logLifecycleEvent} /></TabsContent>
                    <TabsContent value="orgchart" className="focus-visible:outline-none">
                        <OrgChartTab 
                            employees={employees} 
                            departments={departments} 
                            onEmployeeClick={handleEmployeeClick}
                        />
                    </TabsContent>
                    <TabsContent value="timetracking" className="focus-visible:outline-none">
                        <TimeTrackingPanel isStaff={isStaff} isManager={isManager} />
                    </TabsContent>
                    <TabsContent value="auditassign" className="focus-visible:outline-none">
                        <AuditLogAssignmentBoard
                            managers={employees.filter(e => {
                                // Filter to managers/staff only
                                return e.role === 'ops_manager' || e.role === 'admin';
                            })}
                            employees={employees}
                        />
                    </TabsContent>
                    <TabsContent value="resources" className="focus-visible:outline-none">
                        <ResourcePlanningTab />
                    </TabsContent>
                    {hasPermission("hr.manage") && <TabsContent value="assignments" className="focus-visible:outline-none"><Card className="border-none shadow-sm p-6"><VendorAssignment initialDepartmentId={selectedDeptId} /></Card></TabsContent>}
                    {isStaff && <TabsContent value="team" className="focus-visible:outline-none"><Card className="border-none shadow-sm p-6"><TeamManagement departmentId={selectedDeptId} /></Card></TabsContent>}
                    {hasPermission("hr.manage") && <TabsContent value="designations" className="focus-visible:outline-none"><Card className="border-none shadow-sm p-6"><DesignationManagement /></Card></TabsContent>}
                    {hasPermission("users.manage") && <TabsContent value="roles" className="focus-visible:outline-none"><Card className="border-none shadow-sm p-6"><CustomRoleManager /></Card></TabsContent>}
                </Tabs>

                <Dialog open={manageDeptsOpen} onOpenChange={setManageDeptsOpen}>
                    <DialogContent className="bg-background/95 backdrop-blur-xl border-border/20">
                        <DialogHeader><DialogTitle className="text-xl font-bold">Organizational units</DialogTitle></DialogHeader>
                        <div className="space-y-6 pt-4">
                            <div className="flex gap-3">
                                <Input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="New Department Name" className="rounded-xl h-11 border-muted-foreground/20" />
                                <Button onClick={() => addDeptMutation.mutate(newDeptName)} className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20">Create</Button>
                            </div>
                            <div className="max-h-[300px] overflow-auto space-y-2 pr-2 custom-scrollbar">
                                {departments.map(d => (
                                    <div key={d.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-white/10 group hover:bg-muted/50 transition-colors">
                                        <span className="font-bold text-sm">{d.name}</span>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px]">Members: {employees.filter(e => e.department === d.name).length}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <EmployeeIntelligenceProfile 
                    employee={selectedEmployee} 
                    isOpen={profileOpen} 
                    onOpenChange={setProfileOpen} 
                />
            </div>
        </DashboardLayout>
    );
}
