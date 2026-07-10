import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  FileText,
  Download,
  Search,
  Calendar,
  User,
  Filter,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs, useExportAuditLogs } from "@/components/hooks/useAuditLogs";
import { calculateValueDiff, type AuditLogFilter } from "@/components/finance/AuditLogService";
import { getUserInitials, getRoleBadgeColor } from "@/hooks/useMainAuditLogs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function AuditLogViewer() {
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const pageSize = 50;

  const { auditLogs, totalCount, isLoading, isError } = useAuditLogs(
    filter,
    pageSize,
    page * pageSize,
    true // Finance only
  );

  const handleExport = async () => {
    try {
      await useExportAuditLogs(filter);
      toast.success("Audit logs exported successfully");
    } catch (error) {
      toast.error("Failed to export audit logs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleResetFilters = () => {
    setFilter({});
    setPage(0);
    toast.success("Filters reset");
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "bg-success/10 text-success";
      case "update":
        return "bg-info/10 text-info";
      case "delete":
        return "bg-destructive/10 text-destructive";
      case "post":
        return "bg-warning/10 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit logs</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive audit trail for all financial operations
          </p>
        </div>
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={handleResetFilters} variant="outline">
              Reset filters
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Entity Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Entity type
              </label>
              <Select
                value={filter.entity_type || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    entity_type: value === "all" ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="journal_entry">Journal entry</SelectItem>
                  <SelectItem value="vendor_financial_profile">Vendor finance</SelectItem>
                  <SelectItem value="commission_rule">Commission rule</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="payout">Payout</SelectItem>
                  <SelectItem value="rider_payout">Rider payout</SelectItem>
                  <SelectItem value="delivery_payout">Delivery payout</SelectItem>
                  <SelectItem value="rider_payout">Rider payout</SelectItem>
                  <SelectItem value="delivery_payout">Delivery payout</SelectItem>
                  <SelectItem value="financial_transaction">Transaction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity ID Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Entity ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID..."
                  value={filter.entity_id || ""}
                  onChange={(e) =>
                    setFilter({ ...filter, entity_id: e.target.value || undefined })
                  }
                  className="pl-9"
                />
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Start date
              </label>
              <Input
                type="date"
                value={filter.start_date?.toISOString().split("T")[0] || ""}
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    start_date: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                End date
              </label>
              <Input
                type="date"
                value={filter.end_date?.toISOString().split("T")[0] || ""}
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    end_date: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Failed to load audit logs</p>
              <p className="text-sm">Please try again later</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No audit logs found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Entity type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Changed by</TableHead>
                    <TableHead>Changed at</TableHead>
                    <TableHead>Changed fields</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => {
                    const isExpanded = expandedRows.has(log.id);
                    const diffs = calculateValueDiff(log.old_values, log.new_values);

                    return (
                      <>
                        <motion.tr
                          key={log.id}
                          variants={itemVariants}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => toggleRowExpansion(log.id)}
                        >
                          <TableCell>
                            {diffs.length > 0 && (
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </motion.div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.entity_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground">
                              {log.entity_id.slice(0, 8)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border border-border">
                                <AvatarImage src={log.user_profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getUserInitials(
                                    log.user_profile?.full_name || null,
                                    log.user_email || "SYS"
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-medium">
                                  {log.user_profile?.full_name || log.user_email || "System"}
                                </p>
                                {log.user_profile?.main_role && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs h-4 px-1",
                                      getRoleBadgeColor(log.user_profile.main_role)
                                    )}
                                  >
                                    {log.user_profile.main_role}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">
                                {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {log.changed_fields?.join(", ") || "N/A"}
                            </span>
                          </TableCell>
                        </motion.tr>

                        {/* Expanded Row - Show Diffs */}
                        {isExpanded && diffs.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="py-4 px-6 space-y-3"
                              >
                                <h4 className="text-sm font-semibold">Changes</h4>
                                <div className="space-y-2">
                                  {diffs.map((diff, idx) => (
                                    <div
                                      key={idx}
                                      className="grid grid-cols-3 gap-4 text-sm"
                                    >
                                      <div className="font-medium text-muted-foreground">
                                        {diff.field}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          Old:
                                        </span>
                                        <code className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
                                          {JSON.stringify(diff.oldValue)}
                                        </code>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          New:
                                        </span>
                                        <code className="text-xs bg-success/10 text-success px-2 py-1 rounded">
                                          {JSON.stringify(diff.newValue)}
                                        </code>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1} to{" "}
                  {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} logs
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
