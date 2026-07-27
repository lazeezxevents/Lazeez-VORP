import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  User,
  Plus,
  Tag,
  Eye,
  Clock,
  Paperclip,
  ArrowRightLeft,
  Loader2,
  Send,
  Lock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useIssueActivity, useAddComment, ActivityActionType } from "@/hooks/useIssueEnhancements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function getDisplayName(
  user: { full_name: string | null; email: string } | null | undefined
): string {
  return user?.full_name || user?.email?.split("@")[0] || "Unknown";
}

// ---------------------------------------------------------------------------
// Activity icon
// ---------------------------------------------------------------------------

interface ActivityIconProps {
  type: ActivityActionType;
}

function ActivityIcon({ type }: ActivityIconProps) {
  const configs: Record<ActivityActionType, { icon: typeof MessageSquare; color: string; bg: string }> = {
    comment:            { icon: MessageSquare,   color: "text-info",              bg: "bg-info/10" },
    status_change:      { icon: ArrowRightLeft,  color: "text-warning",           bg: "bg-warning/10" },
    priority_change:    { icon: AlertCircle,     color: "text-priority-high",     bg: "bg-priority-high/10" },
    assignment:         { icon: User,            color: "text-primary",           bg: "bg-primary/10" },
    created:            { icon: Plus,            color: "text-success",           bg: "bg-success/10" },
    label_added:        { icon: Tag,             color: "text-info",              bg: "bg-info/10" },
    label_removed:      { icon: Tag,             color: "text-muted-foreground",  bg: "bg-muted" },
    watcher_added:      { icon: Eye,             color: "text-primary",           bg: "bg-primary/10" },
    watcher_removed:    { icon: Eye,             color: "text-muted-foreground",  bg: "bg-muted" },
    attachment_added:   { icon: Paperclip,       color: "text-success",           bg: "bg-success/10" },
    attachment_removed: { icon: Paperclip,       color: "text-destructive",       bg: "bg-destructive/10" },
    time_logged:        { icon: Clock,           color: "text-warning",           bg: "bg-warning/10" },
  };

  const cfg = configs[type] ?? configs.comment;
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${cfg.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
    </div>
  );
}

function buildActivityText(
  type: ActivityActionType,
  oldVal: string | null,
  newVal: string | null,
  user: { full_name: string | null; email: string } | null | undefined
): string {
  const actor = getDisplayName(user);
  switch (type) {
    case "status_change":
      return `${actor} changed status from "${oldVal?.replace("_", " ")}" to "${newVal?.replace("_", " ")}"`;
    case "priority_change":
      return `${actor} changed priority from "${oldVal}" to "${newVal}"`;
    case "assignment":
      return newVal ? `${actor} assigned this issue to ${newVal}` : `${actor} unassigned this issue`;
    case "created":
      return `${actor} created this issue`;
    case "label_added":
      return `${actor} added label "${newVal}"`;
    case "label_removed":
      return `${actor} removed label "${oldVal}"`;
    case "watcher_added":
      return `${actor} added ${newVal || "a user"} as a watcher`;
    case "watcher_removed":
      return `${actor} removed ${oldVal || "a user"} from watchers`;
    case "attachment_added":
      return `${actor} attached "${newVal}"`;
    case "attachment_removed":
      return `${actor} removed attachment "${oldVal}"`;
    case "time_logged":
      return `${actor} logged ${newVal}h`;
    default:
      return `${actor} performed an action`;
  }
}

// ---------------------------------------------------------------------------
// Activity item
// ---------------------------------------------------------------------------

const itemVariants = {
  hidden:   { opacity: 0, y: 8 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

interface ActivityItemProps {
  activity: {
    id: string;
    action_type: ActivityActionType;
    old_value: string | null;
    new_value: string | null;
    comment_text: string | null;
    created_at: string;
    user?: { full_name: string | null; email: string; avatar_url: string | null } | null;
  };
  isLast: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const isComment = activity.action_type === "comment";
  const isOptimistic = activity.id.startsWith("optimistic-");
  const name = getDisplayName(activity.user);
  const initials = getInitials(activity.user?.full_name, activity.user?.email ?? "");

  return (
    <motion.div variants={itemVariants} className="flex gap-3 relative">
      {/* Vertical connector */}
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/60" />
      )}

      {isComment ? (
        <Avatar className="w-7 h-7 shrink-0 mt-0.5">
          <AvatarImage src={activity.user?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <ActivityIcon type={activity.action_type} />
      )}

      <div className="flex-1 min-w-0 pb-4">
        {isComment ? (
          <div className={`rounded-xl p-3 border transition-colors ${
            isOptimistic
              ? "bg-primary/5 border-primary/20 opacity-70"
              : "bg-muted/40 border-border/50"
          }`}>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{name}</span>
                {/* Immutable badge — no edit/delete allowed */}
                <span title="Remarks are permanent and cannot be edited or deleted">
                  <Lock className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                </span>
              </div>
              <span
                className="text-xs text-muted-foreground shrink-0"
                title={format(new Date(activity.created_at), "PPpp")}
              >
                {isOptimistic ? "Saving…" : formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {activity.comment_text}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground leading-snug">
              {buildActivityText(activity.action_type, activity.old_value, activity.new_value, activity.user)}
            </p>
            <span
              className="text-xs text-muted-foreground/70 shrink-0"
              title={format(new Date(activity.created_at), "PPpp")}
            >
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component — "Remarks"
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  issueId: string;
}

export function ActivityTimeline({ issueId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useIssueActivity(issueId);
  const addComment = useAddComment(issueId);
  const [remarkText, setRemarkText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const comments = (activities ?? []).filter((a) => a.action_type === "comment");
  const events   = (activities ?? []).filter((a) => a.action_type !== "comment");
  const [tab, setTab] = useState<"remarks" | "history">("remarks");

  const items = tab === "remarks" ? comments : activities ?? [];

  // Scroll to bottom whenever list grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  const handleSubmit = async () => {
    const text = remarkText.trim();
    if (!text || addComment.isPending) return;
    setRemarkText("");
    // The hook already does optimistic update so the remark shows instantly
    await addComment.mutateAsync(text);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setTab("remarks")}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            tab === "remarks" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Remarks
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
              {comments.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            tab === "history" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          History
          {events.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
              {events.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10 text-muted-foreground"
          >
            {tab === "remarks" ? (
              <>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No remarks yet</p>
                <p className="text-xs">Leave a remark below. It will be permanently recorded.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No history yet</p>
                <p className="text-xs">Status and field changes will appear here.</p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-0"
          >
            <AnimatePresence initial={false}>
              {items.map((activity, idx) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  isLast={idx === items.length - 1}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Remark input — only shown on Remarks tab */}
      {tab === "remarks" && (
        <div className="border-t border-border pt-3 shrink-0">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Add a remark… (Ctrl+Enter to submit)"
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] text-sm resize-none pr-14"
              disabled={addComment.isPending}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!remarkText.trim() || addComment.isPending}
              className="absolute bottom-2 right-2 h-8 w-8"
              title="Submit remark (Ctrl+Enter)"
            >
              {addComment.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Remarks are permanent and cannot be edited or deleted.
          </p>
        </div>
      )}
    </div>
  );
}
