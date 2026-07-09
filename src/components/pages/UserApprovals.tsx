import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    ShieldCheck,
    Search,
    Clock,
    CheckCircle2,
    Users,
    Shield,
    Trash2,
    UserCheck,
    UserX,
    ShieldX,
    XCircle
} from "lucide-react";
import { format } from "date-fns";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyUserApproved, notifyDesignationAssigned } from "@/components/utils/notifications";

type AppRole = "admin" | "manager" | "employee";

interface PendingUser {
    id: string;
    email: string;
    full_name: string | null;
    is_approved: boolean;
    requested_role: string | null;
    created_at: string;
    approved_by: string | null;
    approved_at: string | null;
}

interface UserWithRole extends PendingUser {
    role?: AppRole;
}

const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    employee: "Employee",
};

const roleBadgeColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    manager: "bg-blue-100 text-blue-800 border-blue-200",
    employee: "bg-green-100 text-green-800 border-green-200",
};

export default function UserApprovals() {
    const { user, isAdmin } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState<string>("employee");
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
    const [designationName, setDesignationName] = useState("none");
    const [selectedManagerId, setSelectedManagerId] = useState<string>("none");

    // Fetch custom roles for dropdowns
    const { data: customRoles = [] } = useQuery({
        queryKey: ["custom-roles"],
        queryFn: async () => {
            const { data, error } = await (supabase.from("custom_roles" as any) as any).select("*").order("name");
            if (error) throw error;
            return data as { id: string; name: string; description: string | null }[];
        },
        enabled: isAdmin,
    });

    // Fetch all users with their roles
    const { data: allUsers = [], isLoading } = useQuery({
        queryKey: ["user-approvals"],
        queryFn: async () => {
            const { data: profiles, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false }) as any;

            if (profileError) throw profileError;

            const { data: roles, error: roleError } = await supabase
                .from("user_roles")
                .select("user_id, role");

            if (roleError) throw roleError;

            const roleMap = new Map<string, string>();
            roles?.forEach((r: any) => {
                roleMap.set(r.user_id, r.role);
            });

            return (profiles || []).map((p: any) => ({
                ...p,
                role: roleMap.get(p.id) || "employee",
            })) as UserWithRole[];
        },
        enabled: isAdmin,
    });

    // Fetch potential managers (admins and ops managers)
    const { data: managers = [] } = useQuery({
        queryKey: ["potential-managers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, email, department")
                .order("full_name");
            
            if (error) throw error;
            return data;
        },
        enabled: isAdmin,
    });

    const pendingUsers = allUsers.filter((u) => !u.is_approved);
    const approvedUsers = allUsers.filter((u) => u.is_approved);

    const filteredPending = pendingUsers.filter(
        (u) =>
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredApproved = approvedUsers.filter(
        (u) =>
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const logAuditAction = async (action: string, entityType: string, entityId: string, metadata: any = {}) => {
        try {
            await (supabase.from("audit_logs" as any) as any).insert({
                action,
                entity_type: entityType,
                entity_id: entityId,
                user_email: user?.email,
                metadata
            });
        } catch (err) {
            console.error("Failed to log audit action:", err);
        }
    };

    const approveMutation = useMutation({
        mutationFn: async ({ userId, role, designation, managerId }: { userId: string; role: string; designation?: string; managerId?: string }) => {
            // Check if user came from invitation (has hr_approved_by set)
            const { data: userProfile } = await supabase
                .from("profiles")
                .select("hr_approved_by, hr_approved_at")
                .eq("id", userId)
                .single();
            
            const isInvitationBased = userProfile?.hr_approved_by != null;
            
            // Update profile with approval and designation
            const profileUpdates: any = {
                is_approved: true,
                approved_by: user?.id,
                approved_at: new Date().toISOString(),
                admin_approved_by: user?.id,
                admin_approved_at: new Date().toISOString(),
            };
            
            // If invitation-based, HR approval is already set
            // If self-signup, we need to set HR approval as well (admin acts as HR)
            if (!isInvitationBased) {
                profileUpdates.hr_approved_by = user?.id;
                profileUpdates.hr_approved_at = new Date().toISOString();
            }

            if (managerId && managerId !== "none") {
                profileUpdates.manager_id = managerId;
            }

            // If designation is provided, set designation_id
            if (designation && designation !== "") {
                profileUpdates.designation_id = designation;
            }

            const { error: profileError } = await supabase
                .from("profiles")
                .update(profileUpdates)
                .eq("id", userId);

            if (profileError) throw profileError;

            // Update user role table with base role only (admin, manager, employee)
            const { error: roleError } = await supabase
                .from("user_roles")
                .update({ role: role as any })
                .eq("user_id", userId);

            if (roleError) throw roleError;

            // If designation is provided, create role assignment
            if (designation && designation !== "") {
                const { error: assignError } = await supabase
                    .from("role_assignments")
                    .insert({
                        user_id: userId,
                        role_id: designation,
                        assigned_by: user?.id,
                    });

                if (assignError && assignError.code !== '23505') { // Ignore duplicate key errors
                    console.error("Failed to assign role:", assignError);
                }
            }

            // Log the action
            await logAuditAction("approved", "user_profile", userId, { 
                role, 
                designation,
                manager_id: managerId,
                approved_by: user?.id 
            });

            // Send notifications
            await notifyUserApproved(userId);
            
            // If designation is assigned, notify about that too
            if (designation && designation !== "") {
                const designationData = customRoles.find(r => r.id === designation);
                if (designationData) {
                    await notifyDesignationAssigned(userId, designationData.name);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-approvals"] });
            queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
            toast.success("User approved successfully");
            setApproveDialogOpen(false);
            setSelectedUser(null);
            setDesignationName("none");
            setSelectedManagerId("none");
        },
        onError: (error) => {
            toast.error("Failed to approve user: " + error.message);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase
                .from("profiles")
                .update({
                    is_approved: false,
                    approved_by: null,
                    approved_at: null,
                } as any)
                .eq("id", userId);

            if (error) throw error;

            // Log the action
            await logAuditAction("revoked", "user_profile", userId, { revoked_by: user?.id });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user-approvals"] });
            toast.success("User access revoked");
            setRevokeDialogOpen(false);
            setSelectedUser(null);
        },
        onError: (error) => {
            toast.error("Failed to reject user: " + error.message);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            // First delete from user_roles
            const { error: roleError } = await supabase
                .from("user_roles")
                .delete()
                .eq("user_id", userId);

            if (roleError) console.error("Error deleting user role:", roleError);

            // Then delete from profiles
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", userId);

            if (error) throw error;

            // Log the action
            await logAuditAction("deleted", "user_profile", userId, { deleted_by: user?.id });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user-approvals"] });
            toast.success("User request deleted");
            setDeleteDialogOpen(false);
            setSelectedUser(null);
        },
        onError: (error) => {
            toast.error("Failed to delete user: " + error.message);
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
            const { error } = await supabase
                .from("user_roles")
                .update({ role: role as any })
                .eq("user_id", userId);

            if (error) throw error;

            // Log the action
            await logAuditAction("role_updated", "user_profile", userId, { new_role: role, updated_by: user?.id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-approvals"] });
            toast.success("Role updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update role: " + error.message);
        },
    });

    const handleApproveClick = (u: UserWithRole) => {
        setSelectedUser(u);
        setSelectedRole(u.requested_role || "employee");
        setApproveDialogOpen(true);
    };

    const handleApproveConfirm = () => {
        if (selectedUser) {
            approveMutation.mutate({ 
                userId: selectedUser.id, 
                role: selectedRole,
                designation: designationName === "none" ? "" : designationName,
                managerId: selectedManagerId 
            });
        }
    };

    const handleRevokeClick = (u: UserWithRole) => {
        setSelectedUser(u);
        setRevokeDialogOpen(true);
    };

    const handleRevokeConfirm = () => {
        if (selectedUser) {
            rejectMutation.mutate(selectedUser.id);
        }
    };

    const handleDeleteClick = (u: UserWithRole) => {
        setSelectedUser(u);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (selectedUser) {
            deleteMutation.mutate(selectedUser.id);
        }
    };

    if (!isAdmin) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[60vh]">
                    <p className="text-muted-foreground text-lg">You don't have permission to view this page.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Shield className="w-7 h-7 text-primary" />
                            User Approvals
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage user sign-ups and assign roles
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{pendingUsers.length}</p>
                                    <p className="text-sm text-muted-foreground">Pending Approval</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{approvedUsers.length}</p>
                                    <p className="text-sm text-muted-foreground">Approved Users</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{allUsers.length}</p>
                                    <p className="text-sm text-muted-foreground">Total Users</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="pending" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="pending" className="gap-1.5">
                            <Clock className="w-4 h-4" />
                            Pending 
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
                                {pendingUsers.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="approved" className="gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Approved 
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-full">
                                {approvedUsers.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    {/* Pending Tab */}
                    <TabsContent value="pending">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Pending Approvals</CardTitle>
                                <CardDescription>
                                    New user sign-ups waiting for your approval
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <p className="text-center py-8 text-muted-foreground">Loading...</p>
                                ) : filteredPending.length === 0 ? (
                                    <div className="text-center py-12 space-y-2">
                                        <UserCheck className="w-12 h-12 mx-auto text-muted-foreground/50" />
                                        <p className="text-muted-foreground">No pending approvals</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto -mx-6 px-6">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[150px]">Name</TableHead>
                                                    <TableHead className="min-w-[200px]">Email</TableHead>
                                                    <TableHead className="min-w-[120px]">Requested Role</TableHead>
                                                    <TableHead className="min-w-[200px]">Approval Status</TableHead>
                                                    <TableHead className="min-w-[120px]">Signed Up</TableHead>
                                                    <TableHead className="text-right min-w-[280px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                        <TableBody>
                                            {filteredPending.map((u, index) => (
                                                <TableRow
                                                    key={u.id}
                                                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    <TableCell className="font-medium">
                                                        {u.full_name || "—"}
                                                    </TableCell>
                                                    <TableCell>{u.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={roleBadgeColors[u.requested_role || "employee"]}>
                                                            {roleLabels[u.requested_role || "employee"]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {/* Step 1: User Signup - Always completed */}
                                                            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center">
                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-border" />
                                                            
                                                            {/* Step 2: Admin Approval - Current step */}
                                                            <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary flex items-center justify-center">
                                                                <Clock className="w-2.5 h-2.5 text-primary" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-border" />
                                                            
                                                            {/* Step 3: HR Approval - Pending */}
                                                            <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center">
                                                                <Users className="w-2.5 h-2.5 text-muted-foreground" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-border" />
                                                            
                                                            {/* Step 4: Full Access - Pending */}
                                                            <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center">
                                                                <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-1">Admin approval pending</p>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {format(new Date(u.created_at), "MMM d, yyyy")}
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApproveClick(u)}
                                                            className="gap-1"
                                                        >
                                                            <ShieldCheck className="w-4 h-4" />
                                                            Approve
                                                        </Button>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => handleRevokeClick(u)}
                                                                        className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                                                                    >
                                                                        <ShieldX className="w-4 h-4" />
                                                                        Revoke
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Revoke access (keep account)</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteClick(u)}
                                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Delete permanently</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Approved Tab */}
                    <TabsContent value="approved">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Approved Users</CardTitle>
                                <CardDescription>
                                    Manage roles and access for approved users
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <p className="text-center py-8 text-muted-foreground">Loading...</p>
                                ) : filteredApproved.length === 0 ? (
                                    <div className="text-center py-12 space-y-2">
                                        <UserX className="w-12 h-12 mx-auto text-muted-foreground/50" />
                                        <p className="text-muted-foreground">No approved users found</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto -mx-6 px-6">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[150px]">Name</TableHead>
                                                    <TableHead className="min-w-[200px]">Email</TableHead>
                                                    <TableHead className="min-w-[120px]">Role</TableHead>
                                                    <TableHead className="min-w-[200px]">Approval Status</TableHead>
                                                    <TableHead className="min-w-[120px]">Approved On</TableHead>
                                                    <TableHead className="text-right min-w-[320px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                        <TableBody>
                                            {filteredApproved.map((u, index) => (
                                                <TableRow
                                                    key={u.id}
                                                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    <TableCell className="font-medium">
                                                        {u.full_name || "—"}
                                                    </TableCell>
                                                    <TableCell>{u.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={roleBadgeColors[u.role || "employee"]}>
                                                            {roleLabels[u.role || "employee"]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {/* Step 1: User Signup - Completed */}
                                                            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center">
                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-emerald-500/30" />
                                                            
                                                            {/* Step 2: Admin Approval - Completed */}
                                                            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center">
                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-primary/30" />
                                                            
                                                            {/* Step 3: HR Approval - Current step */}
                                                            <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary flex items-center justify-center">
                                                                <Clock className="w-2.5 h-2.5 text-primary" />
                                                            </div>
                                                            <div className="w-2 h-0.5 bg-border" />
                                                            
                                                            {/* Step 4: Full Access - Pending */}
                                                            <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center">
                                                                <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-1">HR approval pending</p>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {u.approved_at
                                                            ? format(new Date(u.approved_at), "MMM d, yyyy")
                                                            : "Auto-approved"}
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                                                        {u.id !== user?.id && (
                                                            <>
                                                                <Select
                                                                    defaultValue={u.role}
                                                                    onValueChange={(val) =>
                                                                        updateRoleMutation.mutate({ userId: u.id, role: val })
                                                                    }
                                                                >
                                                                    <SelectTrigger className="w-[140px] inline-flex">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="admin">Admin</SelectItem>
                                                                        <SelectItem value="manager">Manager</SelectItem>
                                                                        <SelectItem value="employee">Employee</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1"
                                                                                onClick={() => handleRevokeClick(u)}
                                                                            >
                                                                                <XCircle className="w-4 h-4" />
                                                                                Revoke
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Revoke access</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>

                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() => handleDeleteClick(u)}
                                                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Delete permanently</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </>
                                                        )}
                                                        {u.id === user?.id && (
                                                            <span className="text-xs text-muted-foreground italic">You</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Approve User</DialogTitle>
                        <DialogDescription>
                            Assign a role and approve access for{" "}
                            <span className="font-medium text-foreground">
                                {selectedUser?.full_name || selectedUser?.email}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    {/* Approval Timeline */}
                    <div className="py-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Approval workflow</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Step 1: User Signup */}
                            <div className="flex flex-col items-center flex-1">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="text-[10px] font-medium text-center">User signup</span>
                            </div>
                            <div className="h-0.5 flex-1 bg-border" />
                            
                            {/* Step 2: Admin Approval */}
                            <div className="flex flex-col items-center flex-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-1">
                                    <ShieldCheck className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-[10px] font-medium text-center">Admin approval</span>
                            </div>
                            <div className="h-0.5 flex-1 bg-border" />
                            
                            {/* Step 3: Internal Audit */}
                            <div className="flex flex-col items-center flex-1">
                                <div className="w-8 h-8 rounded-full bg-muted border-2 border-border flex items-center justify-center mb-1">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-center">Internal audit</span>
                            </div>
                            <div className="h-0.5 flex-1 bg-border" />
                            
                            {/* Step 4: HR Approval */}
                            <div className="flex flex-col items-center flex-1">
                                <div className="w-8 h-8 rounded-full bg-muted border-2 border-border flex items-center justify-center mb-1">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-center">HR approval</span>
                            </div>
                            <div className="h-0.5 flex-1 bg-border" />
                            
                            {/* Step 5: Ecosystem Access */}
                            <div className="flex flex-col items-center flex-1">
                                <div className="w-8 h-8 rounded-full bg-muted border-2 border-border flex items-center justify-center mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-center">Full access</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3 text-center">
                            This action completes admin approval. HR approval will be required before full system access.
                        </p>
                    </div>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Base System Role *</label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="employee">Employee</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                Base access level: Admin (full), Manager (department), Employee (standard)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Designation (Role with Permissions)</label>
                            <Select value={designationName} onValueChange={setDesignationName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No Designation" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customRoles.map(cr => (
                                        <SelectItem key={cr.id} value={cr.id}>
                                            {cr.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                Designation from Role & Access feature with RBAC permissions
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reporting Manager</label>
                            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No Manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    {managers.map(m => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.full_name || m.email} ({m.department || "No Dept"})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleApproveConfirm} disabled={approveMutation.isPending}>
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            {approveMutation.isPending ? "Approving..." : "Approve User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revoke Dialog */}
            <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke User Access</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revoke access for{" "}
                            <span className="font-medium text-foreground">
                                {selectedUser?.full_name || selectedUser?.email}
                            </span>?
                            This will prevent them from accessing the platform until they are approved again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRevokeConfirm}
                            disabled={rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? "Revoking..." : "Revoke Access"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User Request</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete the request for{" "}
                            <span className="font-medium text-foreground">
                                {selectedUser?.full_name || selectedUser?.email}
                            </span>?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
