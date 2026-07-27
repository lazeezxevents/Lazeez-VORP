import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, ExternalLink, Clock, User, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  project_id: string;
  project?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  todo:        "bg-info/10 text-info border-info/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  done:        "bg-success/10 text-success border-success/20",
};

const priorityColors: Record<string, string> = {
  low:      "bg-priority-low/10 text-priority-low border-priority-low/20",
  medium:   "bg-priority-medium/10 text-priority-medium border-priority-medium/20",
  high:     "bg-priority-high/10 text-priority-high border-priority-high/20",
  critical: "bg-priority-critical/10 text-priority-critical border-priority-critical/20",
};

export function AssignedTasksWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-assigned-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase.from("project_tasks") as any)
        .select("*, project:projects(name)")
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectTask[];
    },
    enabled: !!user,
  });

  // Real-time — refresh when tasks are assigned to the current user
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-tasks-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "project_tasks",
        filter: `assigned_to=eq.${user.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["my-assigned-tasks", user.id] });

        // On INSERT (new assignment), fire email notification (non-blocking)
        if (payload.eventType === "INSERT") {
          const task = payload.new as ProjectTask;
          sendTaskAssignmentEmail(task, user.email || "").catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const overdueTasks = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          My Assigned Tasks
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {tasks.length > 0 && <Badge variant="secondary">{tasks.length}</Badge>}
          {overdueTasks.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              {overdueTasks.length} overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No tasks assigned</p>
            <p className="text-xs mt-0.5">You're all caught up!</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-2"
          >
            <AnimatePresence initial={false}>
              {tasks.slice(0, 6).map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                return (
                  <motion.div
                    key={task.id}
                    variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => navigate("/projects")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                        <p className={`text-sm font-medium truncate ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                          {task.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        {task.project?.name && <span className="truncate">{task.project.name}</span>}
                        {task.due_date && (
                          <>
                            <span className="opacity-40">·</span>
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className={isOverdue ? "text-destructive font-medium" : ""}>
                              Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 ${priorityColors[task.priority] ?? ""}`}
                        >
                          {task.priority}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 ${statusColors[task.status] ?? ""}`}
                      >
                        {task.status.replace("_", " ")}
                      </Badge>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors ml-0.5" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {tasks.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => navigate("/projects")}
          >
            View all {tasks.length} assigned tasks
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Email helper — fires the send-issue-notification edge function for tasks
// ---------------------------------------------------------------------------

async function sendTaskAssignmentEmail(task: ProjectTask, recipientEmail: string) {
  if (!recipientEmail) return;

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  // We can reuse the same edge function; extend it to handle "task_assignment"
  // type or create a dedicated one. For now, best-effort call.
  try {
    await fetch(`${baseUrl}/functions/v1/send-issue-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        notification_type: "task_assignment",
        task_id: task.id,
        task_title: task.title,
        recipient_email: recipientEmail,
      }),
    });
  } catch {
    // Non-blocking — email is best-effort
  }
}
