// Supabase Edge Function: send-notification
// Sends email via Resend for issue/task assignment events
// Deploy: supabase functions deploy send-notification
// Set secret: supabase secrets set RESEND_API_KEY=re_your_key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Lazeez VORP <notifications@lazeez.events>";

interface NotificationPayload {
  type: "issue_assigned" | "task_assigned" | "issue_watcher_added" | "issue_status_changed";
  recipientEmail: string;
  recipientName: string;
  subject: string;
  // Issue fields
  issueTitle?: string;
  issueStatus?: string;
  issuePriority?: string;
  issueId?: string;
  // Task fields
  taskTitle?: string;
  projectName?: string;
  // Actor
  actorName?: string;
  appUrl?: string;
}

function buildEmailHtml(payload: NotificationPayload): string {
  const appUrl = payload.appUrl || "https://vorp.lazeez.events";
  const priorityColor: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };

  if (payload.type === "issue_assigned") {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700">Issue Assigned to You</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">Lazeez VORP</p>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;font-size:15px;margin:0 0 16px">Hi <strong>${payload.recipientName}</strong>,</p>
      <p style="color:#374151;font-size:14px;margin:0 0 20px">
        ${payload.actorName || "Someone"} assigned you to an issue:
      </p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 24px">
        <h2 style="color:#111827;font-size:16px;margin:0 0 8px">${payload.issueTitle}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0">
          <span style="background:${priorityColor[payload.issuePriority || "medium"] || "#6366f1"}20;color:${priorityColor[payload.issuePriority || "medium"] || "#6366f1"};padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;text-transform:capitalize">${payload.issuePriority}</span>
          <span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:99px;font-size:12px;text-transform:capitalize">${payload.issueStatus?.replace("_", " ")}</span>
        </div>
      </div>
      <a href="${appUrl}/issues" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">View Issue →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6">
      <p style="color:#9ca3af;font-size:12px;margin:0">Lazeez VORP — Vendor Operations & Resource Platform</p>
    </div>
  </div>
</body>
</html>`;
  }

  if (payload.type === "task_assigned") {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:24px 28px">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700">Task Assigned to You</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">${payload.projectName || "Lazeez VORP"}</p>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;font-size:15px;margin:0 0 16px">Hi <strong>${payload.recipientName}</strong>,</p>
      <p style="color:#374151;font-size:14px;margin:0 0 20px">
        ${payload.actorName || "Someone"} assigned you a task in <strong>${payload.projectName || "a project"}</strong>:
      </p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 24px">
        <h2 style="color:#111827;font-size:16px;margin:0">${payload.taskTitle}</h2>
      </div>
      <a href="${appUrl}/projects" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">View Task →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6">
      <p style="color:#9ca3af;font-size:12px;margin:0">Lazeez VORP — Vendor Operations & Resource Platform</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Generic
  return `<p>${payload.subject}</p>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: NotificationPayload = await req.json();

    if (!payload.recipientEmail || !payload.type) {
      return new Response(JSON.stringify({ error: "Missing recipientEmail or type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const html = buildEmailHtml(payload);

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [payload.recipientEmail],
        subject: payload.subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
