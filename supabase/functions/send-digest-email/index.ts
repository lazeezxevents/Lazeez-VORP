import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Set this to a Resend-verified sender address in the Supabase environment.
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Lazeez VORP <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface DigestData {
  userId: string;
  email: string;
  fullName: string;
  digestType: "daily" | "weekly";
}

serve(async (req) => {
  try {
    let { users, digestType } = await req.json();
    
    // If no users provided, fetch them from database
    if (!users || users.length === 0) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
      
      const { data: usersData, error } = await supabase.rpc('get_users_for_digest', {
        digest_type: digestType || 'daily'
      });
      
      if (error) throw error;
      users = usersData || [];
    }
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
    const results = [];

    for (const user of users as DigestData[]) {
      const digestData = await gatherDigestData(supabase, user.userId, digestType);
      const emailHtml = generateDigestEmail(user, digestData, digestType);

      // Send via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [user.email],
          subject: digestType === "daily" 
            ? `Daily Digest - ${new Date().toLocaleDateString()}`
            : `Weekly Digest - Week of ${new Date().toLocaleDateString()}`,
          html: emailHtml,
        }),
      });

      const result = await response.json();
      results.push({ userId: user.userId, success: response.ok, result });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Digest email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function gatherDigestData(supabase: any, userId: string, digestType: string) {
  const now = new Date();
  const startDate = new Date();
  
  if (digestType === "daily") {
    startDate.setDate(now.getDate() - 1);
  } else {
    startDate.setDate(now.getDate() - 7);
  }

  // Assigned issues
  const { data: assignedIssues } = await supabase
    .from("issues")
    .select(`
      id, title, priority, status, created_at, due_date,
      vendor:vendors(name)
    `)
    .eq("assigned_to", userId)
    .in("status", ["open", "in_progress"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  // Watched issues with updates
  const { data: watchedIssues } = await supabase
    .from("issue_watchers")
    .select(`
      issue:issues(
        id, title, priority, status, updated_at,
        vendor:vendors(name)
      )
    `)
    .eq("user_id", userId)
    .gte("issue.updated_at", startDate.toISOString());

  // New issues created
  const { data: newIssues } = await supabase
    .from("issues")
    .select("id, title, priority, vendor:vendors(name)")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  // Upcoming deadlines (next 3 days)
  const deadlineDate = new Date();
  deadlineDate.setDate(now.getDate() + 3);
  
  const { data: upcomingDeadlines } = await supabase
    .from("issues")
    .select(`
      id, title, priority, due_date,
      vendor:vendors(name)
    `)
    .eq("assigned_to", userId)
    .gte("due_date", now.toISOString())
    .lte("due_date", deadlineDate.toISOString())
    .in("status", ["open", "in_progress"])
    .order("due_date", { ascending: true });

  // Assigned project tasks
  const { data: assignedTasks } = await supabase
    .from("project_tasks")
    .select("id, title, status, priority, due_date")
    .eq("assigned_to", userId)
    .in("status", ["todo", "in_progress"])
    .order("priority", { ascending: false })
    .limit(5);

  // Weekly stats (only for weekly digest)
  let weeklyStats = null;
  if (digestType === "weekly") {
    const { data: resolvedCount } = await supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "resolved")
      .gte("resolved_at", startDate.toISOString());

    const { data: timeLogged } = await supabase
      .from("issue_time_logs")
      .select("hours")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    const totalHours = timeLogged?.reduce((sum, log) => sum + log.hours, 0) || 0;

    weeklyStats = {
      issuesResolved: resolvedCount || 0,
      hoursLogged: totalHours.toFixed(2),
    };
  }

  return {
    assignedIssues: assignedIssues || [],
    watchedIssues: watchedIssues?.map(w => w.issue).filter(Boolean) || [],
    newIssues: newIssues || [],
    upcomingDeadlines: upcomingDeadlines || [],
    assignedTasks: assignedTasks || [],
    weeklyStats,
  };
}

function generateDigestEmail(
  user: DigestData,
  data: any,
  digestType: string
): string {
  const priorityColors = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
  };

  const statusBadges = {
    open: '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Open</span>',
    in_progress: '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">In Progress</span>',
    todo: '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">To Do</span>',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${digestType === "daily" ? "Daily" : "Weekly"} Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎯 ${digestType === "daily" ? "Daily" : "Weekly"} Digest</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Hi ${user.fullName},</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    ${data.weeklyStats ? `
    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin-bottom: 24px; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: #16a34a;">📊 Week in Review</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <p style="margin: 0; color: #666; font-size: 14px;">Issues Resolved</p>
          <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">${data.weeklyStats.issuesResolved}</p>
        </div>
        <div>
          <p style="margin: 0; color: #666; font-size: 14px;">Hours Logged</p>
          <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">${data.weeklyStats.hoursLogged}</p>
        </div>
      </div>
    </div>
    ` : ""}

    ${data.upcomingDeadlines.length > 0 ? `
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: #dc2626;">⏰ Upcoming Deadlines (Next 3 Days)</h3>
      ${data.upcomingDeadlines.map((issue: any) => `
        <div style="background: white; padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #fee2e2;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
            <strong style="color: #333; flex: 1;">${issue.title}</strong>
            <span style="background: ${priorityColors[issue.priority as keyof typeof priorityColors]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; white-space: nowrap; margin-left: 8px;">${issue.priority}</span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #666;">
            📅 Due: ${new Date(issue.due_date).toLocaleDateString()} • 
            ${issue.vendor ? `Vendor: ${issue.vendor.name}` : "No vendor"}
          </p>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${data.assignedIssues.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px;">📋 Your Assigned Issues (${data.assignedIssues.length})</h3>
      ${data.assignedIssues.slice(0, 5).map((issue: any) => `
        <div style="background: #f9fafb; padding: 14px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
            <strong style="color: #333; flex: 1;">${issue.title}</strong>
            <span style="background: ${priorityColors[issue.priority as keyof typeof priorityColors]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; white-space: nowrap; margin-left: 8px;">${issue.priority}</span>
          </div>
          <div style="font-size: 13px; color: #666;">
            ${statusBadges[issue.status as keyof typeof statusBadges] || issue.status}
            ${issue.vendor ? ` • Vendor: ${issue.vendor.name}` : ""}
            ${issue.due_date ? ` • Due: ${new Date(issue.due_date).toLocaleDateString()}` : ""}
          </div>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${data.assignedTasks.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px;">✅ Your Project Tasks (${data.assignedTasks.length})</h3>
      ${data.assignedTasks.map((task: any) => `
        <div style="background: #f9fafb; padding: 14px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <strong style="color: #333; flex: 1;">${task.title}</strong>
            <span style="background: ${priorityColors[task.priority as keyof typeof priorityColors]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; white-space: nowrap; margin-left: 8px;">${task.priority}</span>
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 6px;">
            ${statusBadges[task.status as keyof typeof statusBadges] || task.status}
            ${task.due_date ? ` • Due: ${new Date(task.due_date).toLocaleDateString()}` : ""}
          </div>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${data.watchedIssues.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px;">👁️ Watched Issues with Updates</h3>
      ${data.watchedIssues.slice(0, 5).map((issue: any) => `
        <div style="background: #eff6ff; padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #dbeafe;">
          <strong style="color: #333;">${issue.title}</strong>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #666;">
            Status: ${issue.status} • 
            ${issue.vendor ? `Vendor: ${issue.vendor.name} • ` : ""}
            Updated: ${new Date(issue.updated_at).toLocaleString()}
          </p>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${data.newIssues.length > 0 && digestType === "daily" ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px;">🆕 New Issues Today</h3>
      ${data.newIssues.map((issue: any) => `
        <div style="background: #fefce8; padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #fef08a;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <strong style="color: #333; flex: 1;">${issue.title}</strong>
            <span style="background: ${priorityColors[issue.priority as keyof typeof priorityColors]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; white-space: nowrap; margin-left: 8px;">${issue.priority}</span>
          </div>
          ${issue.vendor ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #666;">Vendor: ${issue.vendor.name}</p>` : ""}
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${data.assignedIssues.length === 0 && data.assignedTasks.length === 0 && data.watchedIssues.length === 0 ? `
    <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
      <p style="font-size: 48px; margin: 0 0 16px 0;">🎉</p>
      <p style="font-size: 18px; margin: 0; color: #6b7280;">All caught up!</p>
      <p style="margin: 8px 0 0 0; font-size: 14px;">No pending items for now.</p>
    </div>
    ` : ""}

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
      <a href="${SUPABASE_URL?.replace("supabase.co", "vercel.app") || "https://lazeez-vorp.vercel.app"}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Open Dashboard →
      </a>
    </div>

  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0 0 8px 0;">Lazeez VORP - Vendor Operations & Resource Platform</p>
    <p style="margin: 0;">
      <a href="${SUPABASE_URL?.replace("supabase.co", "vercel.app") || "https://lazeez-vorp.vercel.app"}/settings" style="color: #667eea; text-decoration: none;">Manage notification preferences</a>
    </p>
  </div>

</body>
</html>
  `;
}
