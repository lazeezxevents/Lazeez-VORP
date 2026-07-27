import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type IssuePriority = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  vendor_id: string | null;
  project_id: string | null;
  project_task_id: string | null;
  priority: IssuePriority;
  status: IssueStatus;
  assigned_to: string | null;
  reported_by: string;
  due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string } | null;
  reporter?: { full_name: string | null; email: string } | null;
  assignee?: { full_name: string | null; email: string } | null;
  project?: { name: string } | null;
  project_task?: { title: string; project_id: string } | null;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  vendor_id?: string;
  priority?: IssuePriority;
  due_date?: string;
  assigned_to?: string;
  project_id?: string;
  project_task_id?: string;
}

const baseIssueSelect = `
  *,
  vendor:vendors(name)
`;

const linkedIssueSelect = `
  ${baseIssueSelect},
  project:projects(name),
  project_task:project_tasks(title, project_id)
`;

async function attachIssuePeople<T extends Issue | Issue[] | null>(issues: T): Promise<T> {
  const records = (Array.isArray(issues) ? issues : issues ? [issues] : []) as Issue[];
  const personIds = [
    ...new Set(
      records.flatMap((i) => [i.assigned_to, i.reported_by]).filter(Boolean)
    ),
  ] as string[];
  if (personIds.length === 0) return issues;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", personIds);

  if (!profiles) return issues;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const addPeople = (issue: Issue): Issue => ({
    ...issue,
    assignee: issue.assigned_to ? byId.get(issue.assigned_to) ?? null : null,
    reporter: byId.get(issue.reported_by) ?? null,
  });

  return (
    Array.isArray(issues)
      ? records.map(addPeople)
      : issues
      ? addPeople(issues as Issue)
      : null
  ) as T;
}

// ---------------------------------------------------------------------------
// useIssues — list + real-time subscription
// ---------------------------------------------------------------------------

export function useIssues() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("issues") as any)
        .select(linkedIssueSelect)
        .order("created_at", { ascending: false });

      if (!error) return attachIssuePeople(data as Issue[]);

      // Fallback if project columns don't exist yet
      const { data: fallbackData, error: fallbackError } = await (
        supabase.from("issues") as any
      )
        .select(baseIssueSelect)
        .order("created_at", { ascending: false });

      if (fallbackError) throw fallbackError;
      return attachIssuePeople(fallbackData as Issue[]);
    },
  });

  // Real-time: invalidate list + individual cached issue + activity on any change
  useEffect(() => {
    const channel = supabase
      .channel("issues-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["issues"] });

          if (payload.eventType === "INSERT") {
            const newIssue = payload.new as Issue;
            queryClient.invalidateQueries({ queryKey: ["issues", newIssue.id] });
            toast.info("New issue created", { description: newIssue.title });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Issue;
            const old = payload.old as Issue;
            // Invalidate the individual issue so detail panel refreshes instantly
            queryClient.invalidateQueries({ queryKey: ["issues", updated.id] });
            // Also invalidate activity since a trigger will have fired
            queryClient.invalidateQueries({
              queryKey: ["issue-activity", updated.id],
            });
            if (updated.status !== old.status) {
              const label = updated.status.replace("_", " ");
              toast.info(`Issue ${label}`, {
                description: updated.title,
              });
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as Issue;
            queryClient.removeQueries({ queryKey: ["issues", deleted.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// ---------------------------------------------------------------------------
// useIssue — single issue with real-time
// ---------------------------------------------------------------------------

export function useIssue(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issues", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("issues") as any)
        .select(linkedIssueSelect)
        .eq("id", id)
        .maybeSingle();

      if (!error) return attachIssuePeople(data as Issue | null);

      const { data: fallbackData, error: fallbackError } = await (
        supabase.from("issues") as any
      )
        .select(baseIssueSelect)
        .eq("id", id)
        .maybeSingle();

      if (fallbackError) throw fallbackError;
      return attachIssuePeople(fallbackData as Issue | null);
    },
    enabled: !!id,
    staleTime: 0,
  });

  // Subscribe to changes on this specific issue
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`issue-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "issues", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["issues", id] });
          queryClient.invalidateQueries({ queryKey: ["issue-activity", id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  return query;
}

// ---------------------------------------------------------------------------
// useCreateIssue — auto-start time tracking on creation
// ---------------------------------------------------------------------------

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const { data, error } = await supabase
        .from("issues")
        .insert({ ...input, reported_by: user!.id, created_by: user!.id })
        .select()
        .single();

      if (error) throw error;

      // Auto-add creator as watcher
      try {
        await supabase.from("issue_watchers").insert({
          issue_id: data.id,
          user_id: user!.id,
        });
      } catch {
        /* non-blocking */
      }

      // Auto-start timer if assigned
      if (data.assigned_to) {
        try {
          await supabase.rpc("start_issue_timer", {
            p_issue_id: data.id,
            p_user_id: data.assigned_to,
          });
        } catch {
          /* non-blocking */
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Issue created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create issue: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateIssue — email via existing send-issue-notification edge function
// ---------------------------------------------------------------------------

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Issue> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...input };

      if (input.status === "resolved" || input.status === "closed") {
        updateData.resolved_at = new Date().toISOString();
      }
      // Clear resolved_at when re-opening
      if (input.status === "open" || input.status === "in_progress") {
        updateData.resolved_at = null;
      }

      const { data, error } = await supabase
        .from("issues")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Fire email notifications via the existing edge function (non-blocking)
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      if (input.assigned_to) {
        // Assignment email
        fetch(`${baseUrl}/functions/v1/send-issue-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            issue_id: id,
            notification_type: "assignment",
            assigned_to: input.assigned_to,
          }),
        }).catch(() => {});
      }

      if (input.status && input.status !== (updateData as any).__prev_status) {
        // Status-change email — best effort
        fetch(`${baseUrl}/functions/v1/send-issue-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            issue_id: id,
            notification_type: "status_update",
            new_status: input.status,
          }),
        }).catch(() => {});
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues", data.id] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", data.id] });
      toast.success("Issue updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update issue: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteIssue
// ---------------------------------------------------------------------------

export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Cascade deletes handle activity, attachments, watchers, time_logs
      const { error } = await supabase.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete issue: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Timer Functions - Session-independent
// ---------------------------------------------------------------------------

export function useStartIssueTimer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ issueId }: { issueId: string }) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase.rpc("start_issue_timer", {
        p_issue_id: issueId,
        p_user_id: user.id,
        p_session_id: `session_${Date.now()}`,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ["issue-timer", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-time-logs", issueId] });
      toast.success("Timer started");
    },
    onError: (error: Error) => {
      toast.error(`Failed to start timer: ${error.message}`);
    },
  });
}

export function useStopIssueTimer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ issueId }: { issueId: string }) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase.rpc("stop_issue_timer", {
        p_issue_id: issueId,
        p_user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ["issue-timer", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-time-logs", issueId] });
      toast.success("Timer stopped");
    },
    onError: (error: Error) => {
      toast.error(`Failed to stop timer: ${error.message}`);
    },
  });
}

export function useActiveTimer(issueId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["issue-timer", issueId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc("get_active_timer", {
        p_issue_id: issueId,
        p_user_id: user.id,
      });

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!issueId && !!user?.id,
    refetchInterval: 1000, // Update every second for live timer
  });
}

// ---------------------------------------------------------------------------
// Drag and Drop Reordering
// ---------------------------------------------------------------------------

export function useReorderIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ issueId, newPosition }: { issueId: string; newPosition: number }) => {
      const { error } = await supabase.rpc("reorder_issue", {
        p_issue_id: issueId,
        p_new_position: newPosition,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue reordered");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Archive Functions
// ---------------------------------------------------------------------------

export function useArchiveIssue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (issueId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase.rpc("archive_issue", {
        p_issue_id: issueId,
        p_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue archived");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });
}

export function useUnarchiveIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase.rpc("unarchive_issue", {
        p_issue_id: issueId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue unarchived");
    },
    onError: (error: Error) => {
      toast.error(`Failed to unarchive: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Issue Book Stats
// ---------------------------------------------------------------------------

export function useIssueBookStats() {
  return useQuery({
    queryKey: ["issue-book-stats"],
    queryFn: async () => {
      const [vendorStats, assigneeStats] = await Promise.all([
        supabase.from("issue_book_vendor_stats").select("*"),
        supabase.from("issue_book_assignee_stats").select("*"),
      ]);

      if (vendorStats.error) throw vendorStats.error;
      if (assigneeStats.error) throw assigneeStats.error;

      return {
        vendors: vendorStats.data || [],
        assignees: assigneeStats.data || [],
      };
    },
  });
}
