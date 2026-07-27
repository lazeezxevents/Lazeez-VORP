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
  FolderKanban,
  ListTodo,
  Brain,
  MessageSquare,
  Paperclip,
  Timer,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
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
import { Issue, IssuePriority, IssueStatus, useUpdateIssue, useDeleteIssue, useIssue } from "@/hooks/useIssues";
import { ActivityTimeline } from "./ActivityTimeline";
import { FileUploadSection } from "./FileUploadSection";
import { WatchersSection } from "./WatchersSection";
import { TimeTrackingSection } from "./TimeTrackingSection";
import { IssueTeamChat } from "./IssueTeamChat";
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
// Backdrop
// ---------------------------------------------------------------------------

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const panelVariants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: 24,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 340,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 16,
    transition: {
      duration: 0.18,
      ease: "easeIn",
    },
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IssueDetailPanelProps {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (issue: Issue) => void;
  onOpenAI?: (issue: Issue) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueDetailPanel({
  issue: issueProp,
  open,
  onClose,
  onEdit,
  onOpenAI,
}: IssueDetailPanelProps) {
  const { isAdmin } = useAuth();
  const updateIssue = useUpdateIssue();
  const deleteIssueMutation = useDeleteIssue();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Always subscribe to the live version of this issue so the panel refreshes
  // in real-time when status/priority/assignment change.
  const { data: liveIssue } = useIssue(issueProp?.id ?? "");
  const issue = liveIssue ?? issueProp;

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issue) return;
    await updateIssue.mutateAsync({ id: issue.id, status: newStatus });
  };

  const handlePriorityChange = async (newPriority: IssuePriority) => {
    if (!issue) return;
    await updateIssue.mutateAsync({ id: issue.id, priority: newPriority });
  };

  const handleDelete = async () => {
    if (!issue) return;
    await deleteIssueMutation.mutateAsync(issue.id);
    setDeleteDialogOpen(false);
    onClose();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {open && issue && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
              aria-modal="true"
              role="dialog"
              aria-label={`Issue: ${issue.title}`}
            >
              <motion.div
                className="
                  pointer-events-auto
                  w-full max-w-3xl
                  bg-background
                  border border-border
                  rounded-2xl
                  shadow-2xl
                  flex flex-col
                  overflow-hidden
                  max-h-[90vh]
                "
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* ── Header ── */}
                <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Issue
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          #{issue.id.slice(0, 8)}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-foreground leading-snug mb-2.5">
                        {issue.title}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={priorityConfig[issue.priority].color}>
                          {issue.priority}
                        </Badge>
                        <Select
                          value={issue.status}
                          onValueChange={(val) => handleStatusChange(val as IssueStatus)}
                        >
                          <SelectTrigger className="h-6 w-auto text-xs border-none shadow-none px-0 focus:ring-0">
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
                        {issue.vendor?.name && (
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                            {issue.vendor.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Header actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {onOpenAI && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => onOpenAI(issue)}
                          title="AI Assistant"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          AI Assist
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => { onEdit(issue); onClose(); }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 ml-1"
                        onClick={onClose}
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Tabs ── */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    <div className="px-6 pt-3 shrink-0 border-b border-border">
                      <TabsList className="h-9 bg-transparent p-0 gap-1">
                        <TabsTrigger
                          value="overview"
                          className="h-9 px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent"
                        >
                          Overview
                        </TabsTrigger>
                        <TabsTrigger
                          value="remarks"
                          className="h-9 px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent gap-1.5"
                        >
                          <BookOpen className="w-3 h-3" />
                          Remarks
                        </TabsTrigger>
                        <TabsTrigger
                          value="chat"
                          className="h-9 px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent gap-1.5"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Team Chat
                        </TabsTrigger>
                        <TabsTrigger
                          value="attachments"
                          className="h-9 px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent gap-1.5"
                        >
                          <Paperclip className="w-3 h-3" />
                          Attachments
                        </TabsTrigger>
                        <TabsTrigger
                          value="time"
                          className="h-9 px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent gap-1.5"
                        >
                          <Timer className="w-3 h-3" />
                          Time
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab content scrollable area */}
                    <div className="flex-1 overflow-y-auto">

                      {/* ── Overview ── */}
                      <TabsContent value="overview" className="p-6 m-0 space-y-6">
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-6"
                        >
                          {/* Description */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                              Description
                            </label>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                              {issue.description || "No description provided."}
                            </p>
                          </div>

                          {/* Metadata grid */}
                          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Tag className="w-3 h-3" /> Vendor
                              </label>
                              <p className="text-sm text-foreground">{issue.vendor?.name || "—"}</p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" /> Due date
                              </label>
                              <p className="text-sm text-foreground">
                                {issue.due_date
                                  ? format(new Date(issue.due_date), "MMM d, yyyy")
                                  : "—"}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
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

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
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

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <User className="w-3 h-3" /> Assigned to
                              </label>
                              <p className="text-sm text-foreground">
                                {issue.assignee?.full_name || issue.assignee?.email || "—"}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <User className="w-3 h-3" /> Reported by
                              </label>
                              <p className="text-sm text-foreground">
                                {issue.reporter?.full_name || issue.reporter?.email || "—"}
                              </p>
                            </div>

                            {issue.project?.name && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <FolderKanban className="w-3 h-3" /> Project
                                </label>
                                <p className="text-sm text-foreground">{issue.project.name}</p>
                              </div>
                            )}

                            {issue.project_task?.title && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <ListTodo className="w-3 h-3" /> Project task
                                </label>
                                <p className="text-sm text-foreground">{issue.project_task.title}</p>
                              </div>
                            )}

                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Created
                              </label>
                              <p className="text-sm text-foreground">
                                {format(new Date(issue.created_at), "MMM d, yyyy HH:mm")}
                              </p>
                            </div>

                            {issue.resolved_at && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> Resolved
                                </label>
                                <p className="text-sm text-foreground">
                                  {format(new Date(issue.resolved_at), "MMM d, yyyy HH:mm")}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Watchers */}
                          <WatchersSection issueId={issue.id} />
                        </motion.div>
                      </TabsContent>

                      {/* ── Remarks ── */}
                      <TabsContent value="remarks" className="p-6 m-0 h-[460px]">
                        <ActivityTimeline issueId={issue.id} />
                      </TabsContent>

                      {/* ── Team Chat ── */}
                      <TabsContent value="chat" className="m-0 h-[460px]">
                        <IssueTeamChat issue={issue} />
                      </TabsContent>

                      {/* ── Attachments ── */}
                      <TabsContent value="attachments" className="p-6 m-0">
                        <FileUploadSection issueId={issue.id} />
                      </TabsContent>

                      {/* ── Time ── */}
                      <TabsContent value="time" className="p-6 m-0">
                        <TimeTrackingSection
                          issueId={issue.id}
                          autoStart={false}
                        />
                      </TabsContent>

                    </div>
                  </Tabs>
                </div>

                {/* ── Footer ── */}
                {isAdmin && (
                  <div className="px-6 py-3 border-t border-border shrink-0 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete issue
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{issue?.title}"? This action cannot be undone.
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
