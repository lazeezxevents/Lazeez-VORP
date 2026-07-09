import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, Filter, Clock, FileText, Ticket, Settings, 
  Plus, Edit, Trash2, Users, RefreshCw, DollarSign, Archive, MessageSquare, LockKeyhole
} from "lucide-react";
import { useAuditLogs, AuditLog, getUserInitials, getRoleBadgeColor } from "@/hooks/useMainAuditLogs";
import { useVendors } from "@/hooks/useVendors";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MagneticAssignmentBoard } from "./MagneticAssignmentBoard";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const actionColors: Record<string, string> = {
  created: "bg-success/10 text-success border-success/20",
  updated: "bg-info/10 text-info border-info/20",
  deleted: "bg-destructive/10 text-destructive border-destructive/20",
  status_changed: "bg-warning/10 text-warning border-warning/20",
  assigned: "bg-primary/10 text-primary border-primary/20",
};

const actionIcons: Record<string, React.ElementType> = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  status_changed: Settings,
  assigned: Users,
};

const entityIcons: Record<string, React.ElementType> = {
  vendor: Settings,
  mou: FileText,
  issue: Ticket,
  mou_vault: Archive,
  payment: DollarSign,
  remark: MessageSquare,
};

const entityLabels: Record<string, string> = {
  vendor: "Vendor",
  mou: "MOU",
  issue: "Issue",
  mou_vault: "MOU Document",
  payment: "Payment",
  remark: "Remark",
  // Finance entities
  account: "Account",
  journal_entry: "Journal Entry",
  vendor_financial_profile: "Vendor Finance",
  commission_rule: "Commission Rule",
  invoice: "Invoice",
  revenue: "Revenue",
  expense: "Expense",
  subscription: "Subscription",
  payout: "Payout",
  rider_payout: "Rider Payout",
  delivery_payout: "Delivery Payout",
  financial_transaction: "Transaction",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function getEntityName(values: Record<string, unknown> | null): string {
  if (!values) return "item";
  return (
    (values.name as string) ||
    (values.title as string) ||
    (values.document_name as string) ||
    (values.order_id ? `Order ${values.order_id}` : "") ||
    (values.remark ? `"${(values.remark as string).slice(0, 40)}..."` : "") ||
    "item"
  );
}

function getChangeDescription(log: AuditLog, vendorMap: Map<string, string>): string {
  const action = log.action;
  const entityLabel = entityLabels[log.entity_type] || log.entity_type;
  
  const getVendorSuffix = (values: Record<string, unknown> | null): string => {
    const vendorId = values?.vendor_id as string;
    if (vendorId && vendorMap.has(vendorId)) {
      return ` (${vendorMap.get(vendorId)})`;
    }
    return "";
  };

  if (action === "created") {
    const name = getEntityName(log.new_values as Record<string, unknown> | null);
    const vendor = getVendorSuffix(log.new_values as Record<string, unknown> | null);
    return `Created ${entityLabel}: "${name}"${vendor}`;
  }
  
  if (action === "updated" && log.old_values && log.new_values) {
    const oldVals = log.old_values as Record<string, unknown>;
    const newVals = log.new_values as Record<string, unknown>;
    const vendor = getVendorSuffix(newVals);
    
    if (oldVals.status !== newVals.status) {
      const name = getEntityName(newVals);
      return `${entityLabel} "${name}" status: ${oldVals.status} → ${newVals.status}${vendor}`;
    }
    const name = getEntityName(newVals);
    return `Updated ${entityLabel}: "${name}"${vendor}`;
  }
  
  if (action === "deleted") {
    const name = getEntityName(log.old_values as Record<string, unknown> | null);
    const vendor = getVendorSuffix(log.old_values as Record<string, unknown> | null);
    return `Deleted ${entityLabel}: "${name}"${vendor}`;
  }
  
  return `${action.charAt(0).toUpperCase() + action.slice(1).replace("_", " ")}`;
}

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const { user, isAdmin, isManager } = useAuth();

  const handleResetFilters = () => {
    setSearchQuery("");
    setEntityFilter("all");
    setActionFilter("all");
    setSelectedUserFilter("all");
    toast.success("Filters reset");
  };

  // Fetch all profiles and departments to determine what current user manages
  const { data: userHierarchy } = useQuery({
    queryKey: ["manager-hierarchy", user?.id],
    queryFn: async () => {
      const [profRes, deptRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        (supabase.from("departments" as any) as any).select("*")
      ]);
      if (profRes.error) throw profRes.error;
      if (deptRes.error) throw deptRes.error;
      
      const departments = deptRes.data || [];
      const allProfiles = profRes.data || [];
      
      // Admin sees everyone
      if (isAdmin) {
        return { profiles: allProfiles, allowedUserIds: undefined }; // undefined means no restriction
      }
      
      // Manager only sees themselves + employees in their department(s)
      const managedDeptIds = departments.filter((d: any) => d.manager_id === user?.id).map((d: any) => d.id);
      const allowedProfiles = allProfiles.filter(p => p.id === user?.id || managedDeptIds.includes(p.department_id));
      const allowedUserIds = allowedProfiles.map(p => p.id);
      
      return { profiles: allowedProfiles, allowedUserIds };
    },
    enabled: !!user?.id
  });

  const queryParams: any = { limit: 200 };
  
  if (userHierarchy) {
    if (selectedUserFilter !== "all") {
      queryParams.userId = selectedUserFilter;
    } else if (userHierarchy.allowedUserIds && userHierarchy.allowedUserIds.length > 0) {
      queryParams.userIds = userHierarchy.allowedUserIds;
    } else if (!isAdmin) {
      // Fallback: if not admin and no users allowed, just see own logs
      queryParams.userId = user?.id;
    }
  }

  const { data: logs, isLoading, refetch } = useAuditLogs(queryParams);
  const { data: vendors } = useVendors();

  const vendorMap = new Map<string, string>();
  vendors?.forEach((v) => vendorMap.set(v.id, v.name));

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      getChangeDescription(log, vendorMap).toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  }) || [];

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((groups, log) => {
    const date = format(new Date(log.created_at), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, AuditLog[]>);

  if (!isAdmin && !isManager) {
    return (
      <DashboardLayout title="Audit Logs" subtitle="Security access required">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-rose-500/20 to-orange-500/20 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative w-24 h-24 bg-card border border-rose-500/20 rounded-[40px] flex items-center justify-center shadow-2xl mb-8 group-hover:scale-110 transition-transform duration-500">
              <LockKeyhole className="w-10 h-10 text-rose-500 animate-pulse" />
            </div>
          </div>
          <h3 className="text-2xl font-bold tracking-tight mb-2 bg-gradient-to-br from-slate-900 to-slate-500 bg-clip-text text-transparent font-montserrat dark:from-white dark:to-slate-400">
            Access Restricted
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium leading-relaxed font-poppins">
            You do not have the required Administrator or Manager permissions to view system logs. Please contact your system administrator if you believe this is an error.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Audit Logs" subtitle="Track all changes across the system">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="vendor">Vendors</SelectItem>
                  <SelectItem value="mou">MOUs</SelectItem>
                  <SelectItem value="mou_vault">MOU Documents</SelectItem>
                  <SelectItem value="issue">Issues</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="remark">Remarks</SelectItem>
                </SelectContent>
              </Select>

              {userHierarchy && userHierarchy.profiles.length > 0 && (
                <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                  <SelectTrigger className="w-40">
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {userHierarchy.profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="default" className="gap-2 shrink-0">
                      <Plus className="w-4 h-4" />
                      Assign Logs
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-0 overflow-hidden flex flex-col bg-background border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b border-white/10 bg-black/40 backdrop-blur-md absolute top-0 w-full z-10">
                      <DialogTitle className="text-2xl font-bold text-white font-montserrat">
                        Magnetic Assignments Board
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 w-full h-full overflow-hidden bg-dot-pattern pt-20">
                      <MagneticAssignmentBoard />
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Button variant="outline" size="icon" onClick={handleResetFilters} className="shrink-0 rounded-xl" title="Reset filters">
                <Filter className="w-4 h-4" />
              </Button>

              <Button variant="outline" size="icon" onClick={() => refetch()} className="group shrink-0 rounded-xl" title="Refresh">
                <RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activity Timeline
              {filteredLogs.length > 0 && (
                <Badge variant="secondary">{filteredLogs.length} entries</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No audit logs found</h3>
                <p>Activity will appear here as changes are made</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-8"
                >
                  {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                    <div key={date}>
                      <div className="sticky top-0 bg-background py-2 z-10">
                        <Badge variant="outline" className="font-normal">
                          {format(new Date(date), "EEEE, MMMM d, yyyy")}
                        </Badge>
                      </div>
                      
                      <div className="relative mt-4">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                        
                        <div className="space-y-4">
                          {dateLogs.map((log) => {
                            const ActionIcon = actionIcons[log.action] || Edit;
                            const EntityIcon = entityIcons[log.entity_type] || Settings;
                            const userProfile = log.user_profile;
                            const userName = userProfile?.full_name || log.user_email || "System";
                            const userEmail = log.user_email || "";
                            const userRole = userProfile?.main_role || "system";
                            
                            return (
                              <motion.div
                                key={log.id}
                                variants={itemVariants}
                                className="relative flex gap-4"
                              >
                                <div className={cn(
                                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2",
                                  actionColors[log.action] || "bg-muted border-border"
                                )}>
                                  <ActionIcon className="w-4 h-4" />
                                </div>
                                
                                <div className="flex-1 bg-muted/30 rounded-lg p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      {/* User Profile */}
                                      <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="w-8 h-8 border-2 border-background">
                                          <AvatarImage src={userProfile?.avatar_url || undefined} />
                                          <AvatarFallback className="text-xs font-medium">
                                            {getUserInitials(userProfile?.full_name || null, userEmail)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{userName}</p>
                                            <Badge
                                              variant="outline"
                                              className={cn("text-xs", getRoleBadgeColor(userRole))}
                                            >
                                              {userRole}
                                            </Badge>
                                          </div>
                                          {userEmail && (
                                            <p className="text-xs text-muted-foreground">{userEmail}</p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Action Description */}
                                      <p className="font-medium text-foreground mb-2">
                                        {getChangeDescription(log, vendorMap)}
                                      </p>
                                      
                                      {/* Badges */}
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          <EntityIcon className="w-3 h-3 mr-1" />
                                          {entityLabels[log.entity_type] || log.entity_type}
                                        </Badge>
                                        <Badge 
                                          variant="outline" 
                                          className={cn("text-xs", actionColors[log.action])}
                                        >
                                          {log.action}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {/* Timestamp */}
                                    <div className="text-right">
                                      <span className="text-sm text-muted-foreground">
                                        {format(new Date(log.created_at), "h:mm a")}
                                      </span>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}