import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import {
  Search,
  Plus,
  MoreHorizontal,
  Clock,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List,
  Loader2,
  Brain,
  RefreshCw,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  ListFilter,
  TimerReset,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIssues, useUpdateIssue, useDeleteIssue, Issue, IssuePriority, IssueStatus } from "@/hooks/useIssues";
import { IssueForm } from "@/components/issues/IssueForm";
import { IssueAIAssistant } from "@/components/issues/IssueAIAssistant";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { useAuth } from "@/contexts/AuthContext";
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
import { formatDistanceToNow } from "date-fns";

const priorityConfig: Record<IssuePriority, { color: string; icon: typeof AlertCircle }> = {
  low: { color: "bg-priority-low/10 text-priority-low border-priority-low/20", icon: AlertCircle },
  medium: { color: "bg-priority-medium/10 text-priority-medium border-priority-medium/20", icon: AlertCircle },
  high: { color: "bg-priority-high/10 text-priority-high border-priority-high/20", icon: AlertCircle },
  critical: { color: "bg-priority-critical/10 text-priority-critical border-priority-critical/20", icon: AlertCircle },
};

const statusConfig: Record<IssueStatus, { color: string; icon: typeof Clock }> = {
  open: { color: "bg-info/10 text-info", icon: Clock },
  in_progress: { color: "bg-warning/10 text-warning", icon: Clock },
  resolved: { color: "bg-success/10 text-success", icon: CheckCircle2 },
  closed: { color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

const statusLabels: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const kanbanColumns: IssueStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function Issues() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [deleteIssue, setDeleteIssue] = useState<Issue | null>(null);
  const [aiIssue, setAiIssue] = useState<Issue | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const { data: issues, isLoading, isError, error, refetch } = useIssues();
  const updateIssue = useUpdateIssue();
  const deleteIssueMutation = useDeleteIssue();
  const { isAdmin } = useAuth();

  const filteredIssues = issues?.filter((issue) => {
    const matchesSearch =
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (issue.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesPriority = priorityFilter === "all" || issue.priority === priorityFilter;
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  }) || [];

  const unresolvedIssues = issues?.filter((issue) => issue.status === "open" || issue.status === "in_progress") || [];
  const criticalIssues = unresolvedIssues.filter((issue) => issue.priority === "critical");
  const overdueIssues = unresolvedIssues.filter((issue) => issue.due_date && new Date(issue.due_date) < new Date());
  const resolvedCount = issues?.filter((issue) => issue.status === "resolved" || issue.status === "closed").length || 0;

  const getIssuesByStatus = (status: IssueStatus) =>
    filteredIssues.filter((issue) => issue.status === status);

  const handleEdit = (issue: Issue) => {
    setEditingIssue(issue);
    setFormOpen(true);
  };

  const handleStatusChange = async (issue: Issue, newStatus: IssueStatus) => {
    await updateIssue.mutateAsync({ id: issue.id, status: newStatus });
  };

  const handleDelete = async () => {
    if (deleteIssue) {
      await deleteIssueMutation.mutateAsync(deleteIssue.id);
      setDeleteIssue(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Issues" subtitle="Track and resolve vendor issues">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Issue Management" subtitle="Track, prioritize, and resolve operational work">
        <Card className="border-destructive/40">
          <CardContent className="p-8 text-center space-y-4">
            <CircleAlert className="w-10 h-10 text-destructive mx-auto" />
            <div>
              <p className="font-semibold">Issues could not load</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "Please check your database access and try again."}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Issue Management" subtitle="Track, prioritize, and resolve operational work">
      <div className="space-y-6 animate-fade-in">
        {/* Issue workspace */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <ClipboardList className="h-5 w-5" />
                  <span className="text-sm font-semibold">Operations workspace</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Move every issue to a clear outcome.</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Review workload, focus attention where it is needed, and update progress without leaving the board.
                </p>
              </div>
              <Button className="gap-2 sm:self-start lg:self-auto" onClick={() => { setEditingIssue(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4" />
                Create issue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Workload snapshot */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All issues</p>
              <p className="mt-2 text-2xl font-bold">{issues?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setStatusFilter("open")}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open</p>
              <p className="mt-2 text-2xl font-bold text-info">{getIssuesByStatus("open").length}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setStatusFilter("in_progress")}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In progress</p>
              <p className="mt-2 text-2xl font-bold text-warning">{getIssuesByStatus("in_progress").length}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setPriorityFilter("critical"); setStatusFilter("all"); }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Critical</p>
              <p className="mt-2 text-2xl font-bold text-destructive">{criticalIssues.length}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
              <p className="mt-2 text-2xl font-bold text-success">{resolvedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and board controls */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search issue title, vendor, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-36"><ListFilter className="w-4 h-4 mr-2" /><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priority</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    {kanbanColumns.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 xl:justify-end">
                <Button variant="outline" size="icon" onClick={() => void refetch()} aria-label="Refresh issues"><RefreshCw className="w-4 h-4" /></Button>
                <div className="flex rounded-lg border border-border p-1">
                  <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" className="gap-2" onClick={() => setViewMode("kanban")}><LayoutGrid className="w-4 h-4" /><span className="hidden sm:inline">Board</span></Button>
                  <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" className="gap-2" onClick={() => setViewMode("table")}><List className="w-4 h-4" /><span className="hidden sm:inline">List</span></Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(criticalIssues.length > 0 || overdueIssues.length > 0) && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CircleAlert className="w-5 h-5 text-warning" />
                <div>
                  <p className="font-medium">Attention required</p>
                  <p className="text-sm text-muted-foreground">
                    {criticalIssues.length} critical and {overdueIssues.length} overdue issue{overdueIssues.length === 1 ? "" : "s"} need follow-up.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setPriorityFilter("critical"); setStatusFilter("all"); }}>
                Review critical issues
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {kanbanColumns.map((status, colIdx) => (
              <section key={status} className="animate-stagger-fade-in rounded-2xl border border-border bg-muted/30 p-3" style={{ animationDelay: `${colIdx * 100}ms` }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[status].color}>
                      {statusLabels[status]}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">{getIssuesByStatus(status).length}</span>
                  </div>
                  {status === "in_progress" && <TimerReset className="w-4 h-4 text-warning" />}
                </div>
                <div className="space-y-3">
                  {getIssuesByStatus(status).map((issue, issueIdx) => (
                    <Card
                      key={issue.id}
                      className="cursor-pointer animate-stagger-fade-in border-border/80 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ animationDelay: `${(colIdx * 100) + (issueIdx * 50)}ms` }}
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                            {issue.priority}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(issue)}>
                                Edit Issue
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAiIssue(issue)}>
                                <Brain className="w-4 h-4 mr-2" />
                                AI Assist
                              </DropdownMenuItem>
                              {status !== "in_progress" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(issue, "in_progress")}>
                                  Mark In Progress
                                </DropdownMenuItem>
                              )}
                              {status !== "resolved" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(issue, "resolved")}>
                                  Mark Resolved
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteIssue(issue)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="font-semibold text-sm text-foreground mb-1 leading-5">
                          {issue.title}
                        </p>
                        <div className="min-h-5 text-xs text-muted-foreground mb-3">
                          {issue.vendor?.name || "No vendor linked"}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                          </div>
                          {issue.due_date && (
                            <div className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              <span className={new Date(issue.due_date) < new Date() && issue.status !== "resolved" && issue.status !== "closed" ? "text-destructive" : ""}>
                                Due {formatDistanceToNow(new Date(issue.due_date), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getIssuesByStatus(status).length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl bg-background/60">
                      No issues in this stage
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Issue</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Vendor</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Priority</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Created</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No issues found
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map((issue, index) => (
                        <tr
                          key={issue.id}
                          className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer animate-stagger-fade-in"
                          style={{ animationDelay: `${index * 40}ms` }}
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <td className="p-4">
                            <p className="text-sm font-medium text-foreground">{issue.title}</p>
                            {issue.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                {issue.description}
                              </p>
                            )}
                          </td>
                          <td className="p-4 text-sm text-foreground">
                            {issue.vendor?.name || "-"}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                              {issue.priority}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={statusConfig[issue.status].color}>
                              {statusLabels[issue.status]}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(issue)}>
                                  Edit Issue
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAiIssue(issue)}>
                                  <Brain className="w-4 h-4 mr-2" />
                                  AI Assist
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(issue, "resolved")}>
                                  Mark Resolved
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteIssue(issue)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <IssueForm
        open={formOpen}
        onOpenChange={setFormOpen}
        issue={editingIssue}
      />

      <IssueAIAssistant
        open={!!aiIssue}
        onOpenChange={(open) => !open && setAiIssue(null)}
        issue={aiIssue}
      />

      <IssueDetailSheet
        issue={selectedIssue}
        open={!!selectedIssue}
        onOpenChange={(open) => !open && setSelectedIssue(null)}
        onEdit={(issue) => {
          setEditingIssue(issue);
          setFormOpen(true);
        }}
      />

      <AlertDialog open={!!deleteIssue} onOpenChange={() => setDeleteIssue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this issue? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
