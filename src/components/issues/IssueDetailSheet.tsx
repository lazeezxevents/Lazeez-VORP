import { useState } from "react";
import { motion } from "framer-motion";
import { X, Edit, Trash2, Clock, User, Calendar, Tag, Eye } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Issue, IssuePriority, IssueStatus, useUpdateIssue, useDeleteIssue } from "@/hooks/useIssues";
import { ActivityTimeline } from "./ActivityTimeline";
import { FileUploadSection } from "./FileUploadSection";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const priorityConfig: Record<IssuePriority, { color: string }> = {
  low: { color: "bg-priority-low/10 text-priority-low border-priority-low/20" },
  medium: { color: "bg-priority-medium/10 text-priority-medium border-priority-medium/20" },
  high: { color: "bg-priority-high/10 text-priority-high border-priority-high/20" },
  critical: { color: "bg-priority-critical/10 text-priority-critical border-priority-critical/20" },
};

const statusConfig: Record<IssueStatus, { color: string }> = {
  open: { color: "bg-info/10 text-info" },
  in_progress: { color: "bg-warning/10 text-warning" },
  resolved: { color: "bg-success/10 text-success" },
  closed: { color: "bg-muted text-muted-foreground" },
};

const statusLabels: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const priorities: IssuePriority[] = ["low", "medium", "high", "critical"];
const statuses: IssueStatus[] = ["open", "in_progress", "resolved", "closed"];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface IssueDetailSheetProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (issue: Issue) => void;
}

export function IssueDetailSheet({
  issue,
  open,
  onOpenChange,
  onEdit,
}: IssueDetailSheetProps) {
  const { isAdmin } = useAuth();
  const updateIssue = useUpdateIssue();
  const deleteIssueMutation = useDeleteIssue();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!issue) return null;

  const handleStatusChange = async (newStatus: IssueStatus) => {
    await updateIssue.mutateAsync({ id: issue.id, status: newStatus });
  };

  const handlePriorityChange = async (newPriority: IssuePriority) => {
    await updateIssue.mutateAsync({ id: issue.id, priority: newPriority });
  };

  const handleDelete = async () => {
    await deleteIssueMutation.mutateAsync(issue.id);
    setDeleteDialogOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-full sm:max-w-[600px] flex flex-col p-0 overflow-hidden"
          style={{ transition: "transform 300ms ease-in-out" }}
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-semibold text-foreground leading-snug mb-2">
                  {issue.title}
                </SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                    {issue.priority}
                  </Badge>
                  <Select
                    value={issue.status}
                    onValueChange={(val) => handleStatusChange(val as IssueStatus)}
                  >
                    <SelectTrigger className="h-6 w-auto text-xs border-none shadow-none px-0">
                      <Badge className={statusConfig[issue.status].color}>
                        <SelectValue />
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="time">Time</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Description
                    </label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {issue.description || "No description provided."}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Vendor */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        Vendor
                      </label>
                      <p className="text-sm text-foreground">
                        {issue.vendor?.name || "—"}
                      </p>
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Due Date
                      </label>
                      <p className="text-sm text-foreground">
                        {issue.due_date
                          ? format(new Date(issue.due_date), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        Priority
                      </label>
                      <Select
                        value={issue.priority}
                        onValueChange={(val) => handlePriorityChange(val as IssuePriority)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        Status
                      </label>
                      <Select
                        value={issue.status}
                        onValueChange={(val) => handleStatusChange(val as IssueStatus)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assignee */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Assigned To
                      </label>
                      <p className="text-sm text-foreground">
                        {issue.assignee?.full_name || issue.assignee?.email || "—"}
                      </p>
                    </div>

                    {/* Reporter */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Reported By
                      </label>
                      <p className="text-sm text-foreground">
                        {issue.reporter?.full_name || issue.reporter?.email || "—"}
                      </p>
                    </div>

                    {/* Created */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Created
                      </label>
                      <p className="text-sm text-foreground">
                        {format(new Date(issue.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>

                    {/* Resolved */}
                    {issue.resolved_at && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Resolved
                        </label>
                        <p className="text-sm text-foreground">
                          {format(new Date(issue.resolved_at), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Watchers (placeholder) */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      Watchers
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Watcher management coming soon
                    </p>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="h-[500px]">
                <ActivityTimeline issueId={issue.id} />
              </TabsContent>

              {/* Attachments Tab */}
              <TabsContent value="attachments">
                <FileUploadSection issueId={issue.id} />
              </TabsContent>

              {/* Time Logs Tab */}
              <TabsContent value="time">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-10 text-muted-foreground"
                >
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Time tracking coming soon</p>
                  <p className="text-xs">Log hours and track time spent on this issue.</p>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border shrink-0 flex justify-between items-center">
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    onEdit(issue);
                    onOpenChange(false);
                  }}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{issue.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
