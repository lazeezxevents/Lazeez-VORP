import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface IssueNotificationRequest {
  issue_id: string;
  notification_type: "assignment" | "status_update" | "new_comment";
  assigned_to?: string;
  new_status?: string;
  old_status?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { issue_id, notification_type, assigned_to, new_status, old_status }: IssueNotificationRequest = await req.json();

    console.log(`Processing ${notification_type} notification for Issue: ${issue_id}`);

    // Fetch issue details with vendor
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("*, vendors(name)")
      .eq("id", issue_id)
      .single();

    if (issueError || !issue) {
      console.error("Error fetching issue:", issueError);
      throw new Error(`Issue not found: ${issueError?.message}`);
    }

    let recipientEmails: string[] = [];
    let subject = "";
    let htmlContent = "";
    const vendorName = (issue.vendors as { name?: string })?.name || "No Vendor";

    if (notification_type === "assignment" && assigned_to) {
      // Get assigned user's email
      const { data: assignee, error: assigneeError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", assigned_to)
        .single();

      if (assigneeError || !assignee) {
        console.error("Error fetching assignee:", assigneeError);
        throw new Error("Assignee not found");
      }

      recipientEmails = [assignee.email];
      subject = `🎫 Issue Assigned: ${issue.title}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #ED004F; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Operational Intelligence Portal</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #fce7f3; color: #ED004F; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Assignment Alert</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">New Issue Assigned</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi ${assignee.full_name || "Team Member"},</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">A new operational issue has been assigned to you. Please review the details below:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700;">Issue Details</p>
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${issue.title}</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vendor:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${vendorName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Priority:</td>
                  <td style="padding: 8px 0;">
                    <span style="color: ${issue.priority === 'critical' ? '#dc2626' : issue.priority === 'high' ? '#d97706' : '#2563eb'}; font-size: 13px; font-weight: 700; text-transform: uppercase;">
                      ● ${issue.priority}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <a href="${Deno.env.get("PUBLIC_APP_URL") || 'https://lazeez-vorp.vercel.app'}/issues/${issue.id}" 
               style="display: inline-block; background-color: #ED004F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 10px 0;">
              View in Dashboard
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events & Catering. All rights reserved.</p>
          </div>
        </div>
      `;
    } else if (notification_type === "status_update") {
      // Notify relevant staff
      const { data: staffUsers, error: staffError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "ops_manager"]);

      if (!staffError && staffUsers) {
        const userIds = staffUsers.map(u => u.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", userIds);

        recipientEmails = profiles?.map(p => p.email).filter(Boolean) || [];
      }

      subject = `🎫 Issue Status Updated: ${issue.title}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Operational Intelligence Portal</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #eff6ff; color: #2563eb; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Status Transition</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">Operational Update</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">The status of the following issue has been updated:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${issue.title}</h3>
              
              <div style="display: flex; align-items: center; gap: 12px; margin: 15px 0; background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <span style="color: #94a3b8; font-size: 12px; text-decoration: line-through; font-family: monospace;">${(old_status || issue.status).toUpperCase()}</span>
                <span style="color: #64748b;">→</span>
                <span style="color: #ED004F; font-weight: 800; font-size: 14px; font-family: monospace;">${new_status?.toUpperCase()}</span>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-size: 13px;">Vendor:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 600;">${vendorName}</td>
                </tr>
              </table>
            </div>

            <a href="${Deno.env.get("PUBLIC_APP_URL") || 'https://lazeez-vorp.vercel.app'}/issues/${issue.id}" 
               style="display: inline-block; background-color: #ED004F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 10px 0;">
              View Progress
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
             <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events & Catering. All rights reserved.</p>
          </div>
        </div>
      `;
    }

    if (recipientEmails.length === 0) {
      console.log("No recipients found");
      return new Response(
        JSON.stringify({ message: "No recipients found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending email to ${recipientEmails.length} recipients`);

    const emailResponse = await resend.emails.send({
      from: "Lazeez Events VORP <onboarding@resend.dev>",
      to: recipientEmails,
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-issue-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
