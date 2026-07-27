import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIssues, useUnarchiveIssue } from "@/hooks/useIssues";
import { useState, useMemo } from "react";
import {
  Search,
  Archive,
  ArchiveRestore,
  Calendar,
  User,
  Building2,
  Clock,
  AlertCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";

const priorityConfig = {
  critical: { color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
  high: { color: "bg-warning/10 text-warning border-warning/30", icon: AlertCircle },
  medium: { color: "bg-info/10 text-info border-info/30", icon: AlertCircle },
  low: { color: "bg-success/10 text-success border-success/30", icon: AlertCircle },
};

const statusConfig = {
  resolved: { color: "bg-success/10 text-success border-success/30", label: "Resolved" },
  closed: { color: "bg-muted/10 text-muted-foreground border-muted/30", label: "Closed" },
};

export default function IssueArchive() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allIssues, isLoading } = useIssues();
  const unarchiveIssue = useUnarchiveIssue();

  // Filter only archived issues
  const archivedIssues = useMemo(() => {
    if (!allIssues) return [];
    return allIssues.filter((issue: any) => issue.archived === true);
  }, [allIssues]);

  const filteredIssues = useMemo(() => {
    if (!searchQuery) return archivedIssues;
    
    return archivedIssues.filter((issue: any) =>
      issue.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [archivedIssues, searchQuery]);

  const handleUnarchive = (issueId: string) => {
    unarchiveIssue.mutate(issueId, {
      onSuccess: () => {
        toast.success("Issue unarchived successfully");
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Issue Archive" subtitle="Historical archive of resolved and closed issues">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Issue Archive" subtitle="Historical archive of resolved and closed issues">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Archived</CardTitle>
              <Archive className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{archivedIssues.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="border-success/20 bg-gradient-to-br from-success/5 to-success/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {archivedIssues.filter((i: any) => i.status === "resolved").length}
              </div>
              <p className="text-xs text-muted-foreground">Successfully completed</p>
            </CardContent>
          </Card>

          <Card className="border-muted/20 bg-gradient-to-br from-muted/5 to-muted/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Closed</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {archivedIssues.filter((i: any) => i.status === "closed").length}
              </div>
              <p className="text-xs text-muted-foreground">Administratively closed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search archived issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Archived Issues List */}
        {filteredIssues.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Archive className="w-10 h-10 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">No archived issues</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No issues match your search" : "Archive resolved issues to see them here"}
                  </p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredIssues.map((issue: any, idx: number) => {
              const PriorityIcon = priorityConfig[issue.priority as keyof typeof priorityConfig]?.icon;
              
              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-all border-amber-500/10">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              priorityConfig[issue.priority as keyof typeof priorityConfig]?.color
                            )}>
                              <PriorityIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-base mb-1">{issue.title}</h3>
                              {issue.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {issue.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className={priorityConfig[issue.priority as keyof typeof priorityConfig]?.color}>
                              {issue.priority}
                            </Badge>
                            <Badge className={statusConfig[issue.status as keyof typeof statusConfig]?.color}>
                              {statusConfig[issue.status as keyof typeof statusConfig]?.label}
                            </Badge>
                            {issue.vendor?.name && (
                              <Badge variant="outline" className="gap-1">
                                <Building2 className="w-3 h-3" />
                                {issue.vendor.name}
                              </Badge>
                            )}
                            {issue.assignee?.full_name && (
                              <Badge variant="outline" className="gap-1">
                                <User className="w-3 h-3" />
                                {issue.assignee.full_name}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {issue.archived_at && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Archived {format(new Date(issue.archived_at), "MMM d, yyyy")}
                              </div>
                            )}
                            {issue.resolved_at && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Resolved {format(new Date(issue.resolved_at), "MMM d, yyyy")}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-amber-600 border-amber-500/30 hover:bg-amber-50"
                          onClick={() => handleUnarchive(issue.id)}
                          disabled={unarchiveIssue.isPending}
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          Unarchive
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
