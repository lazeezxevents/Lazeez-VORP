import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Pause,
  ArrowUp,
  LayoutGrid,
  List,
  Loader2,
  Brain
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
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [deleteIssue, setDeleteIssue] = useState<Issue | null>(null);
  const [aiIssue, setAiIssue] = useState<Issue | null>(null);
  const { data: issues, isLoading } = useIssues();
  const updateIssue = useUpdateIssue();
  const deleteIssueMutation = useDeleteIssue();
  const { isAdmin } = useAuth();

  const filteredIssues = issues?.filter((issue) => {
    const matchesSearch =
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (issue.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesPriority = priorityFilter === "all" || issue.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  }) || [];

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

  return (
    <DashboardLayout title="Issues" subtitle="Track and resolve vendor issues">
      <div className="space-y-6 animate-fade-in">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex border border-border rounded-lg p-1">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button className="gap-2" onClick={() => { setEditingIssue(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4" />
              New Issue
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kanbanColumns.map((status, idx) => (
            <Card key={status} className="animate-stagger-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = statusConfig[status].icon;
                    return <Icon className="w-4 h-4 text-muted-foreground" />;
                  })()}
                  <span className="text-sm text-muted-foreground">{statusLabels[status]}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{getIssuesByStatus(status).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
            {kanbanColumns.map((status, colIdx) => (
              <div key={status} className="min-w-[280px] animate-stagger-fade-in" style={{ animationDelay: `${colIdx * 100}ms` }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[status].color}>
                      {statusLabels[status]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {getIssuesByStatus(status).length}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {getIssuesByStatus(status).map((issue, issueIdx) => (
                    <Card
                      key={issue.id}
                      className="cursor-pointer animate-stagger-fade-in"
                      style={{ animationDelay: `${(colIdx * 100) + (issueIdx * 50)}ms` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                            {issue.priority}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
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
                        <p className="font-medium text-sm text-foreground mb-1">
                          {issue.title}
                        </p>
                        {issue.vendor && (
                          <p className="text-xs text-muted-foreground mb-3">
                            {issue.vendor.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getIssuesByStatus(status).length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                      No issues
                    </div>
                  )}
                </div>
              </div>
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
                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
