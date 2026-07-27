/**
 * useNotifications — sends email notifications via the send-notification edge function.
 * Uses Resend API key configured as a Supabase secret.
 *
 * To deploy:
 *   supabase functions deploy send-notification
 *   supabase secrets set RESEND_API_KEY=re_your_new_key
 */
import { supabase } from "@/integrations/supabase/client";

interface IssueAssignedPayload {
  type: "issue_assigned";
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  issueTitle: string;
  issueStatus: string;
  issuePriority: string;
  issueId: string;
}

interface TaskAssignedPayload {
  type: "task_assigned";
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  taskTitle: string;
  projectName: string;
}

type NotificationPayload = IssueAssignedPayload | TaskAssignedPayload;

async function sendNotification(payload: NotificationPayload): Promise<void> {
  const subject =
    payload.type === "issue_assigned"
      ? `Issue assigned: ${payload.issueTitle}`
      : `Task assigned: ${payload.taskTitle}`;

  try {
    const { error } = await supabase.functions.invoke("send-notification", {
      body: { ...payload, subject },
    });
    if (error) {
      console.warn("Email notification failed (non-blocking):", error.message);
    }
  } catch (err) {
    // Email is non-blocking — never throw
    console.warn("Email notification error (non-blocking):", err);
  }
}

export async function notifyIssueAssigned(params: {
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  issueTitle: string;
  issueStatus: string;
  issuePriority: string;
  issueId: string;
}): Promise<void> {
  return sendNotification({ type: "issue_assigned", ...params });
}

export async function notifyTaskAssigned(params: {
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  taskTitle: string;
  projectName: string;
}): Promise<void> {
  return sendNotification({ type: "task_assigned", ...params });
}
