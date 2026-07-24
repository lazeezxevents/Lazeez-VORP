import { useEffect, useRef } from "react";
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
// Activity
// ---------------------------------------------------------------------------

export function useIssueActivity(issueId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue-activity", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_activity")
        .select(`
          *,
          user:profiles(full_name, email, avatar_url)
        `)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as IssueActivity[];
    },
    enabled: !!issueId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!issueId) return;

    const channel = supabase
      .channel(`issue-activity-${issueId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "issue_activity",
          filter: `issue_id=eq.${issueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [issueId, queryClient]);

  return query;
}

export function useAddComment(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (commentText: string) => {
      const { data, error } = await supabase
        .from("issue_activity")
        .insert({
          issue_id: issueId,
          user_id: user!.id,
          action_type: "comment",
          comment_text: commentText,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add comment: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function useIssueAttachments(issueId: string) {
  return useQuery({
    queryKey: ["issue-attachments", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_attachments")
        .select(`
          *,
          uploader:profiles(full_name, email)
        `)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as IssueAttachment[];
    },
    enabled: !!issueId,
  });
}

export function useUploadAttachment(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop();
      const path = `${issueId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("issue-attachments")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("issue-attachments")
        .getPublicUrl(path);

      // Insert attachment record
      const { data, error: dbError } = await supabase
        .from("issue_attachments")
        .insert({
          issue_id: issueId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user!.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Log activity
      await supabase.from("issue_activity").insert({
        issue_id: issueId,
        user_id: user!.id,
        action_type: "attachment_added",
        new_value: file.name,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-attachments", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
      toast.success("File uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload file: ${error.message}`);
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      attachment,
    }: {
      attachment: IssueAttachment;
    }) => {
      // Derive storage path from public URL
      const url = new URL(attachment.file_url);
      const pathParts = url.pathname.split("/issue-attachments/");
      const storagePath = pathParts[1] ?? "";

      if (storagePath) {
        await supabase.storage.from("issue-attachments").remove([storagePath]);
      }

      const { error } = await supabase
        .from("issue_attachments")
        .delete()
        .eq("id", attachment.id);

      if (error) throw error;

      // Log activity
      await supabase.from("issue_activity").insert({
        issue_id: attachment.issue_id,
        user_id: user!.id,
        action_type: "attachment_removed",
        old_value: attachment.file_name,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["issue-attachments", variables.attachment.issue_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["issue-activity", variables.attachment.issue_id],
      });
      toast.success("Attachment deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete attachment: ${error.message}`);
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
      const { data, error } = await supabase
        .from("issue_labels")
        .select("*")
        .order("name");

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
        .select(`
          *,
          label:issue_labels(*)
        `)
        .eq("issue_id", issueId);

      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        issue_id: string;
        label_id: string;
        created_at: string;
        label: IssueLabel;
      }>;
    },
    enabled: !!issueId,
  });
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

export function useIssueWatchers(issueId: string) {
  return useQuery({
    queryKey: ["issue-watchers", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_watchers")
        .select(`
          *,
          user:profiles(full_name, email, avatar_url)
        `)
        .eq("issue_id", issueId);

      if (error) throw error;
      return data as unknown as IssueWatcher[];
    },
    enabled: !!issueId,
  });
}

export function useAddWatcher(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (watcherUserId: string) => {
      const { data, error } = await supabase
        .from("issue_watchers")
        .insert({
          issue_id: issueId,
          user_id: watcherUserId,
          added_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
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
      const { error } = await supabase
        .from("issue_watchers")
        .delete()
        .eq("id", watcherId);

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
// Time Logs
// ---------------------------------------------------------------------------

export function useIssueTimeLogs(issueId: string) {
  return useQuery({
    queryKey: ["issue-time-logs", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_time_logs")
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq("issue_id", issueId)
        .order("logged_date", { ascending: false });

      if (error) throw error;
      return data as unknown as IssueTimeLog[];
    },
    enabled: !!issueId,
  });
}

export function useAddTimeLog(issueId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddTimeLogInput) => {
      const { data, error } = await supabase
        .from("issue_time_logs")
        .insert({
          issue_id: issueId,
          user_id: user!.id,
          hours: input.hours,
          description: input.description,
          logged_date: input.logged_date,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from("issue_activity").insert({
        issue_id: issueId,
        user_id: user!.id,
        action_type: "time_logged",
        new_value: String(input.hours),
        metadata: { description: input.description, logged_date: input.logged_date },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-time-logs", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-activity", issueId] });
      toast.success("Time logged successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to log time: ${error.message}`);
    },
  });
}
