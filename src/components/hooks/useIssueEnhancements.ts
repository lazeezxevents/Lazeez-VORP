import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityActionType =
  | "comment"
  | "status_change"
  | "priority_change"
  | "assignment"
  | "created"
  | "label_added"
  | "label_removed"
  | "watcher_added"
  | "watcher_removed"
  | "attachment_added"
  | "attachment_removed"
  | "time_logged";

export interface IssueActivity {
  id: string;
  issue_id: string;
  user_id: string;
  action_type: ActivityActionType;
  old_value: string | null;
  new_value: string | null;
  comment_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export interface IssueAttachment {
  id: string;
  issue_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    full_name: string | null;
    email: string;
  } | null;
}

export interface IssueLabel {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface IssueWatcher {
  id: string;
  issue_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export interface IssueTimeLog {
  id: string;
  issue_id: string;
  user_id: string;
  hours: number;
  description: string | null;
  logged_date: string;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
  } | null;
}

export interface AddTimeLogInput {
  hours: number;
  description?: string;
  logged_date: string;
}

// ---------------------------------------------------------------------------
// Activity / Remarks
// ---------------------------------------------------------------------------

export function useIssueActivity(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-activity", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_activity")
        .select("*, user:profiles(full_name, email, avatar_url)")
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as IssueActivity[];
    },
    enabled: !!issueId,
    staleTime: 0, // always fresh
  });

  // Real-time subscription — both INSERT and UPDATE
  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`issue-activity-${issueId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "issue_activity",
        filter: `issue_id=eq.${issueId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [issueId, queryClient]);

  return query;
}

export function useAddComment(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (commentText: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("issue_activity")
        .insert({
          issue_id: issueId,
          user_id: user.id,
          action_type: "comment",
          comment_text: commentText,
        })
        .select("*, user:profiles(full_name, email, avatar_url)")
        .single();
      if (error) throw error;
      return data;
    },
    // Optimistic: immediately append to cache so it shows without delay
    onMutate: async (commentText: string) => {
      await queryClient.cancelQueries({ queryKey: ["issue-activity", issueId] });
      const previous = queryClient.getQueryData<IssueActivity[]>(["issue-activity", issueId]);
      const tempItem: IssueActivity = {
        id: `optimistic-${Date.now()}`,
        issue_id: issueId,
        user_id: user?.id ?? "",
        action_type: "comment",
        old_value: null,
        new_value: null,
        comment_text: commentText,
        metadata: null,
        created_at: new Date().toISOString(),
        user: null,
      };
      queryClient.setQueryData<IssueActivity[]>(["issue-activity", issueId], (old) => [
        ...(old ?? []),
        tempItem,
      ]);
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["issue-activity", issueId], context.previous);
      }
      toast.error("Failed to add remark");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function useIssueAttachments(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-attachments", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_attachments")
        .select("*, uploader:profiles(full_name, email)")
        .eq("issue_id", issueId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as IssueAttachment[];
    },
    enabled: !!issueId,
    staleTime: 0,
  });

  // Real-time
  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`issue-attachments-${issueId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "issue_attachments",
        filter: `issue_id=eq.${issueId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["issue-attachments", issueId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [issueId, queryClient]);

  return query;
}

export function useUploadAttachment(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${issueId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("issue-attachments")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("issue-attachments")
        .getPublicUrl(path);

      const { data, error: dbError } = await supabase
        .from("issue_attachments")
        .insert({
          issue_id: issueId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (dbError) throw dbError;

      // Log activity (non-blocking)
      supabase.from("issue_activity").insert({
        issue_id: issueId,
        user_id: user.id,
        action_type: "attachment_added",
        new_value: file.name,
      }).then(() => {});

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-attachments", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
      toast.success("File uploaded");
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ attachment }: { attachment: IssueAttachment }) => {
      if (!user) throw new Error("Not authenticated");
      // Extract storage path
      try {
        const url = new URL(attachment.file_url);
        const marker = "/object/public/issue-attachments/";
        const idx = url.pathname.indexOf(marker);
        const storagePath = idx !== -1 ? decodeURIComponent(url.pathname.slice(idx + marker.length)) : "";
        if (storagePath) {
          await supabase.storage.from("issue-attachments").remove([storagePath]);
        }
      } catch {
        // non-fatal if URL parsing fails
      }

      const { error } = await supabase.from("issue_attachments").delete().eq("id", attachment.id);
      if (error) throw error;

      supabase.from("issue_activity").insert({
        issue_id: attachment.issue_id,
        user_id: user.id,
        action_type: "attachment_removed",
        old_value: attachment.file_name,
      }).then(() => {});
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["issue-attachments", variables.attachment.issue_id] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", variables.attachment.issue_id] });
      toast.success("Attachment deleted");
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function useIssueLabels() {
  return useQuery({
    queryKey: ["issue-labels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issue_labels").select("*").order("name");
      if (error) throw error;
      return data as unknown as IssueLabel[];
    },
  });
}

export function useIssueLabelRelations(issueId: string) {
  return useQuery({
    queryKey: ["issue-label-relations", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_label_relations")
        .select("*, label:issue_labels(*)")
        .eq("issue_id", issueId);
      if (error) throw error;
      return data as unknown as Array<{
        id: string; issue_id: string; label_id: string; created_at: string; label: IssueLabel;
      }>;
    },
    enabled: !!issueId,
  });
}

// ---------------------------------------------------------------------------
// Watchers — FIXED: upsert to avoid duplicate key errors
// ---------------------------------------------------------------------------

export function useIssueWatchers(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-watchers", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_watchers")
        .select("*, user:profiles(full_name, email, avatar_url)")
        .eq("issue_id", issueId);
      if (error) throw error;
      return data as unknown as IssueWatcher[];
    },
    enabled: !!issueId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`issue-watchers-${issueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_watchers", filter: `issue_id=eq.${issueId}` },
        () => queryClient.invalidateQueries({ queryKey: ["issue-watchers", issueId] })
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [issueId, queryClient]);

  return query;
}

export function useAddWatcher(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (watcherUserId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if already watching — prevents duplicate constraint violation
      const { data: existing } = await supabase
        .from("issue_watchers")
        .select("id")
        .eq("issue_id", issueId)
        .eq("user_id", watcherUserId)
        .maybeSingle();

      if (existing) {
        // Already a watcher — silently succeed
        return existing;
      }

      const { data, error } = await supabase
        .from("issue_watchers")
        .insert({ issue_id: issueId, user_id: watcherUserId, added_by: user.id })
        .select("*, user:profiles(full_name, email, avatar_url)")
        .single();
      if (error) {
        // 23505 = unique violation — another concurrent insert beat us, not an error
        if (error.code === "23505") return null;
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-watchers", issueId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add watcher: ${error.message}`);
    },
  });
}

export function useRemoveWatcher(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watcherId: string) => {
      const { error } = await supabase.from("issue_watchers").delete().eq("id", watcherId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-watchers", issueId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove watcher: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Watched Issues (for dashboard — current user's watched issues)
// ---------------------------------------------------------------------------

export function useMyWatchedIssues() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-watched-issues", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("issue_watchers")
        .select(`
          issue_id,
          issue:issues(
            id, title, status, priority, created_at, updated_at,
            vendor:vendors(name)
          )
        `)
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => row.issue)
        .filter(Boolean) as Array<{
          id: string; title: string; status: string; priority: string;
          created_at: string; updated_at: string; vendor: { name: string } | null;
        }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-watched-issues-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_watchers", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-watched-issues", user.id] })
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return query;
}

// ---------------------------------------------------------------------------
// Time Logs — FIXED: real-time + auto-init on issue creation
// ---------------------------------------------------------------------------

export function useIssueTimeLogs(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-time-logs", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_time_logs")
        .select("*, user:profiles(full_name, email)")
        .eq("issue_id", issueId)
        .order("logged_date", { ascending: false });
      if (error) throw error;
      return data as unknown as IssueTimeLog[];
    },
    enabled: !!issueId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`issue-time-logs-${issueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_time_logs", filter: `issue_id=eq.${issueId}` },
        () => queryClient.invalidateQueries({ queryKey: ["issue-time-logs", issueId] })
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [issueId, queryClient]);

  return query;
}

export function useAddTimeLog(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddTimeLogInput) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("issue_time_logs")
        .insert({
          issue_id: issueId,
          user_id: user.id,
          hours: input.hours,
          description: input.description,
          logged_date: input.logged_date,
        })
        .select()
        .single();
      if (error) throw error;

      supabase.from("issue_activity").insert({
        issue_id: issueId,
        user_id: user.id,
        action_type: "time_logged",
        new_value: String(input.hours),
        metadata: { description: input.description, logged_date: input.logged_date },
      }).then(() => {});

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-time-logs", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
      toast.success("Time logged");
    },
    onError: (error: Error) => {
      toast.error(`Failed to log time: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Persistent Issue Chat Messages
// ---------------------------------------------------------------------------

export interface IssueChatMessage {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  is_ai: boolean;
  ai_agent_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export function useIssueChatMessages(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-chat", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_chat_messages")
        .select("*, user:profiles(full_name, email, avatar_url)")
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as IssueChatMessage[];
    },
    enabled: !!issueId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`issue-chat-${issueId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "issue_chat_messages",
        filter: `issue_id=eq.${issueId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ["issue-chat", issueId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [issueId, queryClient]);

  return query;
}

export function useSendChatMessage(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      content,
      isAi = false,
      aiAgentName,
    }: {
      content: string;
      isAi?: boolean;
      aiAgentName?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("issue_chat_messages")
        .insert({
          issue_id: issueId,
          user_id: user.id,
          content,
          is_ai: isAi,
          ai_agent_name: aiAgentName ?? null,
        })
        .select("*, user:profiles(full_name, email, avatar_url)")
        .single();
      if (error) throw error;
      return data;
    },
    // Optimistic insert for instant display
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["issue-chat", issueId] });
      const previous = queryClient.getQueryData<IssueChatMessage[]>(["issue-chat", issueId]);
      const tempMsg: IssueChatMessage = {
        id: `optimistic-${Date.now()}`,
        issue_id: issueId,
        user_id: user?.id ?? "",
        content: vars.content,
        is_ai: vars.isAi ?? false,
        ai_agent_name: vars.aiAgentName ?? null,
        metadata: null,
        created_at: new Date().toISOString(),
        user: null,
      };
      queryClient.setQueryData<IssueChatMessage[]>(["issue-chat", issueId], (old) => [
        ...(old ?? []),
        tempMsg,
      ]);
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["issue-chat", issueId], context.previous);
      }
      toast.error("Failed to send message");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-chat", issueId] });
    },
  });
}
