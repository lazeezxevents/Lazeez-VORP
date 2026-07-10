import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Shield, Loader2, Pencil, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Permission categories for the UI ──
const PERMISSION_CATEGORIES = [
    {
        module: "general",
        label: "General",
        permissions: [
            { slug: "dashboard.view", name: "View Dashboard", description: "Access main dashboard" },
            { slug: "settings.view", name: "View Settings", description: "Access settings page" },
            { slug: "settings.manage", name: "Manage Settings", description: "Modify system settings" },
        ]
    },
    {
        module: "vendors",
        label: "Vendors",
        permissions: [
            { slug: "vendors.view", name: "View Vendors", description: "View vendor list and details" },
            { slug: "vendors.manage", name: "Manage Vendors", description: "Create, edit, delete vendors" },
            { slug: "vendors.documents", name: "Manage Documents", description: "Upload/manage vendor docs" },
            { slug: "vendors.payments", name: "Manage Payments", description: "Track vendor payments" },
        ]
    },
    {
        module: "issues",
        label: "Issues & Tickets",
        permissions: [
            { slug: "issues.view", name: "View Issues", description: "View issue list" },
            { slug: "issues.manage", name: "Manage Issues", description: "Create and update issues" },
            { slug: "issues.assign", name: "Assign Issues", description: "Assign issues to team members" },
            { slug: "issues.resolve", name: "Resolve Issues", description: "Mark issues as resolved" },
        ]
    },
    {
        module: "mous",
        label: "MOUs & Contracts",
        permissions: [
            { slug: "mous.view", name: "View MOUs", description: "View MOU list" },
            { slug: "mous.manage", name: "Manage MOUs", description: "Create and edit MOUs" },
            { slug: "mous.approve", name: "Approve MOUs", description: "Approve pending MOUs" },
            { slug: "mous.vault", name: "Access MOU Vault", description: "Access contract vault" },
        ]
    },
    {
        module: "delivery",
        label: "Delivery & Logistics",
        permissions: [
            { slug: "delivery.view", name: "View Dispatch", description: "Access dispatch center" },
            { slug: "delivery.manage", name: "Manage Scheduling", description: "Plan five-day lead orders" },
            { slug: "delivery.riders", name: "Rider Management", description: "Onboard and track riders" },
            { slug: "delivery.tracking", name: "Live Tracking", description: "Monitor active deliveries on map" },
            { slug: "delivery.returns", name: "Manage Returns", description: "Track equipment/catering returns" },
        ]
    },
    {
        module: "analytics",
        label: "Analytics & Reports",
        permissions: [
            { slug: "analytics.view", name: "View Analytics", description: "Access analytics dashboard" },
            { slug: "analytics.export", name: "Export Reports", description: "Export data as reports" },
            { slug: "audit.view", name: "View Audit Logs", description: "Access system audit trail" },
        ]
    },
    {
        module: "comms",
        label: "Communication & Settings",
        permissions: [
            { slug: "notifications.manage", name: "Manage Notifications", description: "Configure notifications" },
            { slug: "settings.manage", name: "Global Settings", description: "General system settings" },
            { slug: "system.settings", name: "System Preferences", description: "Access global system tab" },
            { slug: "email.branding", name: "Email Branding", description: "Manage custom email templates" },
            { slug: "calendar.view", name: "View Calendar", description: "Access event calendar" },
            { slug: "calendar.manage", name: "Manage Calendar", description: "Create/edit events" },
        ]
    },
];

// ── Types ──
interface CustomRole {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

interface RolePermission {
    id: string;
    role_id: string;
    permission_id: string;
    permission_slug?: string;
}

interface AppPermission {
    id: string;
    name: string;
    slug: string;
    module: string;
    description: string | null;
}

export function CustomRoleManager() {
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();

    const [createOpen, setCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);

    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    // ── Queries ──
    const { data: customRoles = [], isLoading: isRolesLoading } = useQuery({
        queryKey: ["custom-roles"],
        queryFn: async () => {
            const { data, error } = await supabase.from("custom_roles").select("*").order("created_at", { ascending: false });
            if (error) throw error;
            return data as CustomRole[];
        },
        enabled: isAdmin,
    });

    const { data: appPermissions = [] } = useQuery({
        queryKey: ["app-permissions"],
        queryFn: async () => {
            const { data, error } = await supabase.from("app_permissions").select("*").order("module");
            if (error) throw error;
            return data as AppPermission[];
        },
        enabled: isAdmin,
    });

    const { data: allRolePermissions = [] } = useQuery({
        queryKey: ["role-permissions"],
        queryFn: async () => {
            const { data, error } = await supabase.from("role_permissions").select("*, app_permissions(slug)");
            if (error) throw error;
            return (data || []).map((rp: any) => ({
                ...rp,
                permission_slug: rp.app_permissions?.slug,
            })) as RolePermission[];
        },
        enabled: isAdmin,
    });

    // ── Mutations ──
    const createRoleMutation = useMutation({
        mutationFn: async ({ name, description, permissionSlugs }: { name: string; description: string; permissionSlugs: string[] }) => {
            const { data: role, error: roleError } = await supabase
                .from("custom_roles").insert({ 
                    name, 
                    display_name: name, // Use name as display_name
                    description: description || null 
                }).select().single();
            if (roleError) throw roleError;

            if (permissionSlugs.length > 0) {
                const permIds = appPermissions.filter(p => permissionSlugs.includes(p.slug)).map(p => ({ role_id: role.id, permission_id: p.id }));
                if (permIds.length > 0) {
                    const { error: rpError } = await supabase.from("role_permissions").insert(permIds);
                    if (rpError) throw rpError;
                }
            }
            return role;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
            toast.success("Custom role created successfully");
            resetForm(); setCreateOpen(false);
        },
        onError: (err: any) => toast.error(err.message || "Failed to create role"),
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ roleId, name, description, permissionSlugs }: { roleId: string; name: string; description: string; permissionSlugs: string[] }) => {
            const { error: roleError } = await supabase.from("custom_roles").update({ 
                name, 
                display_name: name, // Update display_name when name changes
                description: description || null 
            }).eq("id", roleId);
            if (roleError) throw roleError;

            const { error: delError } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
            if (delError) throw delError;

            if (permissionSlugs.length > 0) {
                const permIds = appPermissions.filter(p => permissionSlugs.includes(p.slug)).map(p => ({ role_id: roleId, permission_id: p.id }));
                if (permIds.length > 0) {
                    const { error: rpError } = await supabase.from("role_permissions").insert(permIds);
                    if (rpError) throw rpError;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
            toast.success("Role updated");
            resetForm(); setEditingRole(null);
        },
        onError: (err: any) => toast.error(err.message || "Failed to update role"),
    });

    const deleteRoleMutation = useMutation({
        mutationFn: async (roleId: string) => {
            const { error } = await supabase.from("custom_roles").delete().eq("id", roleId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
            toast.success("Role deleted"); setDeleteTarget(null);
        },
        onError: (err: any) => toast.error(err.message || "Failed to delete role"),
    });

    // ── Helpers ──
    function resetForm() { setRoleName(""); setRoleDescription(""); setSelectedPermissions([]); }

    function openEdit(role: CustomRole) {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || "");
        const roleSlugs = allRolePermissions.filter(rp => rp.role_id === role.id).map(rp => rp.permission_slug).filter(Boolean) as string[];
        setSelectedPermissions(roleSlugs);
    }

    function togglePermission(slug: string) {
        setSelectedPermissions(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
    }

    function toggleAllInCategory(categorySlugs: string[]) {
        const allSelected = categorySlugs.every(s => selectedPermissions.includes(s));
        setSelectedPermissions(prev => allSelected ? prev.filter(s => !categorySlugs.includes(s)) : [...new Set([...prev, ...categorySlugs])]);
    }

    function getPermissionCountForRole(roleId: string) {
        return allRolePermissions.filter(rp => rp.role_id === roleId).length;
    }

    function getPermissionSlugsForRole(roleId: string) {
        return allRolePermissions.filter(rp => rp.role_id === roleId).map(rp => rp.permission_slug).filter(Boolean) as string[];
    }

    const totalPerms = PERMISSION_CATEGORIES.reduce((sum, c) => sum + c.permissions.length, 0);

    if (!isAdmin) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Shield className="w-10 h-10 mx-auto text-muted-foreground opacity-30 mb-4" />
                    <p className="text-muted-foreground">Only administrators can manage custom roles.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-base sm:text-lg font-semibold">Custom Roles</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Create and manage custom roles with specific permissions.
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2 w-full sm:w-auto" size="sm">
                    <Plus className="w-4 h-4" /> Create Role
                </Button>
            </div>

            {/* Roles List */}
            {isRolesLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : customRoles.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                        <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-base sm:text-lg font-semibold">No Custom Roles Yet</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm max-w-sm text-center mt-2">
                            Create your first custom role to define granular access permissions for team members.
                        </p>
                        <Button className="mt-6" size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Create First Role
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {customRoles.map(role => {
                        const permCount = getPermissionCountForRole(role.id);
                        const permSlugs = getPermissionSlugsForRole(role.id);
                        const isExpanded = expandedRole === role.id;

                        return (
                            <Card key={role.id} className="transition-all hover:shadow-md">
                                <CardContent className="p-0">
                                    <div
                                        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer gap-3"
                                        onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">{role.name}</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                                    {role.description || "No description"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                                            <Badge variant="secondary" className="text-[10px] sm:text-xs hidden sm:inline-flex">
                                                {permCount} perm{permCount !== 1 ? "s" : ""}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8"
                                                onClick={(e) => { e.stopPropagation(); openEdit(role); }}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon"
                                                className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                                            <Separator className="mb-3" />
                                            <div className="flex flex-wrap gap-1.5">
                                                {permSlugs.length > 0 ? permSlugs.map(slug => (
                                                    <Badge key={slug} variant="outline" className="text-[10px]">
                                                        {PERMISSION_CATEGORIES.flatMap(c => c.permissions).find(p => p.slug === slug)?.name || slug}
                                                    </Badge>
                                                )) : (
                                                    <p className="text-xs text-muted-foreground italic">No permissions assigned</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create Role Dialog */}
            <RoleFormDialog
                open={createOpen}
                onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}
                title="Create Custom Role"
                description="Define a new role with specific permissions."
                onSubmit={() => createRoleMutation.mutate({ name: roleName, description: roleDescription, permissionSlugs: selectedPermissions })}
                isPending={createRoleMutation.isPending}
                submitLabel="Create Role"
                loadingLabel="Creating..."
                roleName={roleName}
                setRoleName={setRoleName}
                roleDescription={roleDescription}
                setRoleDescription={setRoleDescription}
                selectedPermissions={selectedPermissions}
                totalPerms={totalPerms}
                togglePermission={togglePermission}
                toggleAllInCategory={toggleAllInCategory}
            />

            {/* Edit Role Dialog */}
            <RoleFormDialog
                open={!!editingRole}
                onOpenChange={(open) => { if (!open) { setEditingRole(null); resetForm(); } }}
                title={`Edit Role: ${editingRole?.name || ""}`}
                description="Modify this role's name, description, and permissions."
                onSubmit={() => editingRole && updateRoleMutation.mutate({ roleId: editingRole.id, name: roleName, description: roleDescription, permissionSlugs: selectedPermissions })}
                isPending={updateRoleMutation.isPending}
                submitLabel="Save Changes"
                loadingLabel="Saving..."
                roleName={roleName}
                setRoleName={setRoleName}
                roleDescription={roleDescription}
                setRoleDescription={setRoleDescription}
                selectedPermissions={selectedPermissions}
                totalPerms={totalPerms}
                togglePermission={togglePermission}
                toggleAllInCategory={toggleAllInCategory}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. All permission assignments for this role will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && deleteRoleMutation.mutate(deleteTarget.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                        >
                            {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Role Form Dialog Component ──
const RoleFormDialog = ({
    open, onOpenChange, title, description, onSubmit, isPending, submitLabel, loadingLabel,
    roleName, setRoleName, roleDescription, setRoleDescription, selectedPermissions,
    totalPerms, togglePermission, toggleAllInCategory
}: any) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-4xl">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-4 py-2">
                {/* Left: Role info */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs">Role Name</Label>
                        <Input
                            value={roleName}
                            onChange={e => setRoleName(e.target.value)}
                            placeholder="e.g. Vendor Coordinator"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && roleName.trim() && !isPending) {
                                    onSubmit();
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={roleDescription} onChange={e => setRoleDescription(e.target.value)} placeholder="Brief description" rows={3} />
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{selectedPermissions.length}</span> of {totalPerms} permissions selected
                        </p>
                    </div>
                </div>
                {/* Right: Permission grid */}
                <div className="space-y-2">
                    <Label className="text-xs">Permissions</Label>
                    <PermissionSelector
                        selectedPermissions={selectedPermissions}
                        togglePermission={togglePermission}
                        toggleAllInCategory={toggleAllInCategory}
                    />
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={onSubmit} disabled={!roleName.trim() || isPending} className="w-full sm:w-auto">
                    {isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {loadingLabel}</>) : submitLabel}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

// ── Permission Selector Component ──
const PermissionSelector = ({ selectedPermissions, togglePermission, toggleAllInCategory }: any) => (
    <ScrollArea className="h-[350px] sm:h-[400px] pr-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PERMISSION_CATEGORIES.map(category => {
                const categorySlugs = category.permissions.map(p => p.slug);
                const allSelected = categorySlugs.every(s => selectedPermissions.includes(s));
                const someSelected = categorySlugs.some(s => selectedPermissions.includes(s));

                return (
                    <div key={category.module} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`cat-${category.module}`}
                                checked={allSelected}
                                onCheckedChange={() => toggleAllInCategory(categorySlugs)}
                                className={someSelected && !allSelected ? "opacity-50" : ""}
                            />
                            <Label htmlFor={`cat-${category.module}`} className="text-xs font-semibold text-foreground cursor-pointer">{category.label}</Label>
                            <Badge variant="secondary" className="text-[9px] ml-auto">
                                {categorySlugs.filter(s => selectedPermissions.includes(s)).length}/{categorySlugs.length}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            {category.permissions.map(perm => (
                                <label
                                    key={perm.slug}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                    <Checkbox
                                        id={`perm-${perm.slug}`}
                                        checked={selectedPermissions.includes(perm.slug)}
                                        onCheckedChange={() => togglePermission(perm.slug)}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">{perm.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{perm.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    </ScrollArea>
);
