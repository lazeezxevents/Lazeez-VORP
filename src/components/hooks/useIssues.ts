import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const personIds = [...new Set(records.flatMap((issue) => [issue.assigned_to, issue.reported_by]).filter(Boolean))] as string[];
  if (personIds.length === 0) return issues;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", personIds);

  if (!profiles) return issues;
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const addPeople = (issue: Issue): Issue => ({
    ...issue,
    assignee: issue.assigned_to ? byId.get(issue.assigned_to) || null : null,
    reporter: byId.get(issue.reported_by) || null,
  });

  return (Array.isArray(issues) ? records.map(addPeople) : issues ? addPeople(issues as Issue) : null) as T;
}

export function useIssues() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("issues") as any)
        .select(linkedIssueSelect)
        .order("created_at", { ascending: false });

      if (!error) return attachIssuePeople(data as Issue[]);

      // Keep the Issue workspace usable if the optional project-link migration
      // has not yet been applied to a live database.
      const { data: fallbackData, error: fallbackError } = await (supabase
        .from("issues") as any)
        .select(baseIssueSelect)
        .order("created_at", { ascending: false });

      if (fallbackError) throw fallbackError;
      return attachIssuePeople(fallbackData as Issue[]);
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("issues-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "issues",
        },
        (payload) => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["issues"] });
          
          // Show toast for new issues
          if (payload.eventType === "INSERT") {
            toast.info("New issue created", {
              description: (payload.new as Issue).title,
            });
          } else if (payload.eventType === "UPDATE") {
            const newData = payload.new as Issue;
            const oldData = payload.old as Issue;
            if (newData.status !== oldData.status) {
              toast.info("Issue status updated", {
                description: `${newData.title} → ${newData.status.replace("_", " ")}`,
              });
            }
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

export function useIssue(id: string) {
  return useQuery({
    queryKey: ["issues", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("issues") as any)
        .select(linkedIssueSelect)
        .eq("id", id)
        .maybeSingle();

      if (!error) return attachIssuePeople(data as Issue | null);

      const { data: fallbackData, error: fallbackError } = await (supabase
        .from("issues") as any)
        .select(baseIssueSelect)
        .eq("id", id)
        .maybeSingle();

      if (fallbackError) throw fallbackError;
      return attachIssuePeople(fallbackData as Issue | null);
    },
    enabled: !!id,
  });
}

import { useMutation } from "@tanstack/react-query";

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const { data, error } = await supabase
        .from("issues")
        .insert({
          ...input,
          reported_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create issue: ${error.message}`);
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Issue> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...input };
      
      // Set resolved_at when status changes to resolved
      if (input.status === "resolved" || input.status === "closed") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("issues")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues", data.id] });
      toast.success("Issue updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update issue: ${error.message}`);
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete issue: ${error.message}`);
    },
  });
}
