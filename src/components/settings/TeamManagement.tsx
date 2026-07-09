import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUsers, useDesignations, useCustomRoles, useUpdateUserRole, useUpdateUserProfile, AppRole } from "@/components/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Search, UserPlus, Edit, Shield, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  ops_manager: "Manager",
  employee: "Employee",
};

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  ops_manager: "bg-warning/10 text-warning",
  employee: "bg-info/10 text-info",
};

export function TeamManagement() {
  const { user, isAdmin } = useAuth();
  const { data: users, isLoading } = useUsers();
  const { data: designations } = useDesignations();
  const { data: customRoles } = useCustomRoles();
  const updateRole = useUpdateUserRole();
  const updateProfile = useUpdateUserProfile();

  const [searchQuery, setSearchQuery] = useState("");
  const [editUser, setEditUser] = useState<typeof users extends (infer T)[] ? T : never | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("employee");

  const filteredUsers = users?.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.designation?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = async () => {
    if (!editUser) return;
    await updateRole.mutateAsync({ userId: editUser.id, role: selectedRole as any });
    setRoleDialogOpen(false);
    setEditUser(null);
  };

  const openRoleDialog = (userToEdit: NonNullable<typeof editUser>) => {
    setEditUser(userToEdit);
    setSelectedRole(userToEdit.custom_role_id || userToEdit.role || "employee");
    setRoleDialogOpen(true);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Management
            </CardTitle>
            <CardDescription>
              Manage team members, roles, and designations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="gradient-primary text-primary-foreground text-sm">
                          {getInitials(u.full_name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {u.full_name || "Unnamed User"}
                          {u.id === user?.id && (
                            <span className="text-xs text-muted-foreground ml-2">(you)</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.custom_role_id && customRoles ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                        {customRoles.find(cr => cr.id === u.custom_role_id)?.name || "Custom Role"}
                      </Badge>
                    ) : u.role ? (
                      <Badge className={roleColors[u.role]}>
                        {roleLabels[u.role]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No role</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.designation?.name || (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.department || (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRoleDialog(u)}
                      disabled={!isAdmin && u.role === "admin"}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Role
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Role Assignment Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update role for {editUser?.full_name || editUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Role</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && (
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Badge className={roleColors.admin}>Admin</Badge>
                          <span className="text-sm text-muted-foreground">Full access</span>
                        </div>
                      </SelectItem>
                    )}
                    {isAdmin && (
                      <SelectItem value="ops_manager">
                        <div className="flex items-center gap-2">
                          <Badge className={roleColors.ops_manager}>Manager</Badge>
                          <span className="text-sm text-muted-foreground">Can manage team & vendors</span>
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="employee">
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors.employee}>Employee</Badge>
                        <span className="text-sm text-muted-foreground">Assigned vendor access</span>
                      </div>
                    </SelectItem>
                    {customRoles?.map(cr => (
                      <SelectItem key={cr.id} value={cr.id}>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">{cr.name}</Badge>
                          <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                            {cr.description || "Custom role"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Role Permissions:</p>
                {selectedRole === "admin" && (
                  <p className="text-muted-foreground">
                    Full access to all features, can manage all users including managers
                  </p>
                )}
                {selectedRole === "ops_manager" && (
                  <p className="text-muted-foreground">
                    Can manage vendors, issues, MOUs, and employees. Cannot add/remove managers.
                  </p>
                )}
                {selectedRole === "employee" && (
                  <p className="text-muted-foreground">
                    Can view and manage assigned vendors only. Cannot access admin features.
                  </p>
                )}
                {customRoles?.find(cr => cr.id === selectedRole) && (
                  <p className="text-muted-foreground">
                    {customRoles.find(cr => cr.id === selectedRole)?.description || "Custom role with specific permissions configured in Settings."}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRoleChange} disabled={updateRole.isPending}>
                {updateRole.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
