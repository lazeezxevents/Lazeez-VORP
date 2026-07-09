import { useState } from "react";
import { motion } from "framer-motion";
import { useInvitations } from "@/components/hooks/useInvitations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Plus, RefreshCw, XCircle, Clock, CheckCircle2, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function InvitationManagement() {
  const { invitations, isLoading, createInvitation, resendInvitation, revokeInvitation, isCreating } = useInvitations();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch custom roles
  const { data: roles = [] } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("id, display_name, main_role")
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const handleCreateInvitation = () => {
    if (!email || !departmentId || !roleId) {
      return;
    }

    createInvitation({ email, departmentId, roleId });
    setIsCreateDialogOpen(false);
    setEmail("");
    setDepartmentId("");
    setRoleId("");
  };

  const filteredInvitations = invitations.filter((inv: any) => {
    const matchesSearch = 
      inv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.department?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-amber-100 text-amber-800", label: "Pending" },
      accepted: { color: "bg-green-100 text-green-800", label: "Accepted" },
      expired: { color: "bg-slate-100 text-slate-800", label: "Expired" },
      revoked: { color: "bg-red-100 text-red-800", label: "Revoked" },
      delivery_failed: { color: "bg-red-100 text-red-800", label: "Delivery Failed" },
    };
    
    const config = configs[status] || configs.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getExpirationStatus = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    
    if (expiration < now) {
      return <span className="text-red-600 text-sm">Expired</span>;
    }
    
    return (
      <span className="text-muted-foreground text-sm">
        Expires {formatDistanceToNow(expiration, { addSuffix: true })}
      </span>
    );
  };

  const statusCounts = {
    all: invitations.length,
    pending: invitations.filter((inv: any) => inv.status === 'pending').length,
    accepted: invitations.filter((inv: any) => inv.status === 'accepted').length,
    expired: invitations.filter((inv: any) => {
      const expiration = new Date(inv.expires_at);
      return expiration < new Date() && inv.status === 'pending';
    }).length,
    revoked: invitations.filter((inv: any) => inv.status === 'revoked').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Invitations</h2>
          <p className="text-muted-foreground">Invite new employees with designated roles</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Invitation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "All", count: statusCounts.all, color: "bg-slate-100" },
          { label: "Pending", count: statusCounts.pending, color: "bg-amber-100" },
          { label: "Accepted", count: statusCounts.accepted, color: "bg-green-100" },
          { label: "Expired", count: statusCounts.expired, color: "bg-slate-100" },
          { label: "Revoked", count: statusCounts.revoked, color: "bg-red-100" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <span className="font-bold">{stat.count}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({statusCounts.pending})</TabsTrigger>
          <TabsTrigger value="accepted">Accepted ({statusCounts.accepted})</TabsTrigger>
          <TabsTrigger value="revoked">Revoked ({statusCounts.revoked})</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading invitations...</div>
              ) : filteredInvitations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No invitations found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvitations.map((invitation: any, index: number) => (
                      <motion.tr
                        key={invitation.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b"
                      >
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{invitation.department?.name || '—'}</TableCell>
                        <TableCell>{invitation.designation?.display_name || '—'}</TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(invitation.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{getExpirationStatus(invitation.expires_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {invitation.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resendInvitation(invitation.id)}
                                className="gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Resend
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => revokeInvitation(invitation.id)}
                                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-3 h-3" />
                                Revoke
                              </Button>
                            </>
                          )}
                          {invitation.status === 'accepted' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Invitation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Employee Invitation</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new employee with their designated role
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@lazeezevents.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Designation *</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name} ({role.main_role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvitation} 
              disabled={!email || !departmentId || !roleId || isCreating}
            >
              {isCreating ? "Creating..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
