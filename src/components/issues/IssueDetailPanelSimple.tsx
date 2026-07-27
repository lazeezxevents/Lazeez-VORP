import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Edit,
  Trash2,
  Clock,
  User,
  Calendar,
  Tag,
  Brain,
} from "lucide-react";
import { format } from "date-fns";
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
import { useAuth } from "@/contexts/AuthContext";

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

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { opacity: 0, scale: 0.94, y: 24 },
};

interface IssueDetailPanelProps {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  onEdit: (issue: Issue) => void;
  onOpenAI?: (issue: Issue) => void;
}

export function IssueDetailPanelSimple({
  issue,
  open,
  onClose,
  onEdit,
  onOpenAI,
}: IssueDetailPanelProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const { isAdmin } = useAuth();

  if (!issue) return null;

  const handleDelete = async () => {
    await deleteIssue.mutateAsync(issue.id);
    setDeleteDialogOpen(false);
    onClose();
  };

  const handleStatusChange = async (newStatus: IssueStatus) => {
    await updateIssue.mutateAsync({ id: issue.id, status: newStatus });
  };

  const handlePriorityChange = async (newPriority: IssuePriority) => {
    await updateIssue.mutateAsync({ id: issue.id, priority: newPriority });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                  {issue.priority}
                </Badge>
                <Badge className={statusConfig[issue.status].color}>
                  {statusLabels[issue.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {onOpenAI && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenAI(issue)}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    AI Assist
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(issue)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{issue.title}</h2>
                </div>

                {/* Description */}
                {issue.description && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{issue.description}</p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Status
                    </label>
                    <Select
                      value={issue.status}
                      onValueChange={(value) => handleStatusChange(value as IssueStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Priority
                    </label>
                    <Select
                      value={issue.priority}
                      onValueChange={(value) => handlePriorityChange(value as IssuePriority)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vendor */}
                  {issue.vendor && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Vendor
                      </label>
                      <p className="text-sm text-foreground">{issue.vendor.name}</p>
                    </div>
                  )}

                  {/* Assigned To */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Assigned To
                    </label>
                    <p className="text-sm text-foreground">
                      {issue.assignee?.full_name || issue.assignee?.email || "Unassigned"}
                    </p>
                  </div>

                  {/* Created */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Created
                    </label>
                    <p className="text-sm text-foreground">
                      {format(new Date(issue.created_at), "PPp")}
                    </p>
                  </div>

                  {/* Due Date */}
                  {issue.due_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Due Date
                      </label>
                      <p className="text-sm text-foreground">
                        {format(new Date(issue.due_date), "PPp")}
                      </p>
                    </div>
                  )}

                  {/* Resolved At */}
                  {issue.resolved_at && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Resolved
                      </label>
                      <p className="text-sm text-foreground">
                        {format(new Date(issue.resolved_at), "PPp")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Delete Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Issue</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this issue? This action cannot be undone.
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
      )}
    </AnimatePresence>
  );
}
