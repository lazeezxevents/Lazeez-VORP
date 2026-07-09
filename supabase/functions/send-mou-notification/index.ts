import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MOUNotificationRequest {
  mou_id: string;
  notification_type: "status_change" | "expiration_reminder";
  new_status?: string;
  days_until_expiration?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mou_id, notification_type, new_status, days_until_expiration }: MOUNotificationRequest = await req.json();

    console.log(`Processing ${notification_type} notification for MOU ${mou_id}`);

    // Fetch MOU details with vendor
    const { data: mou, error: mouError } = await supabase
      .from("mous")
      .select(`
        *,
        vendor:vendors(name, email, contact_person)
      `)
      .eq("id", mou_id)
      .single();

    if (mouError || !mou) {
      console.error("Failed to fetch MOU:", mouError);
      throw new Error("MOU not found");
    }

    // Fetch staff users to notify (admins and ops_managers)
    const { data: staffRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "ops_manager"]);

    if (rolesError) {
      console.error("Failed to fetch staff roles:", rolesError);
      throw new Error("Failed to fetch staff users");
    }

    const staffUserIds = staffRoles?.map((r) => r.user_id) || [];
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("id", staffUserIds);

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError);
      throw new Error("Failed to fetch staff profiles");
    }

    const recipientEmails = profiles?.map((p) => p.email).filter(Boolean) || [];

    if (recipientEmails.length === 0) {
      console.log("No recipients found for notification");
      return new Response(JSON.stringify({ message: "No recipients found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let subject: string;
    let htmlContent: string;
    const vendorName = mou.vendor?.name || "Unknown Vendor";
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || 'https://lazeez-vorp.vercel.app';

    if (notification_type === "status_change") {
      subject = `📄 MOU Status Updated: ${mou.title}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Contract Lifecycle Management</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">MOU Update</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">Status Modification</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">The MOU status for <strong>${mou.title}</strong> has been updated to <strong>${new_status?.replace("_", " ").toUpperCase()}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vendor:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${vendorName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">New Status:</td>
                  <td style="padding: 8px 0; color: #ED004F; font-size: 14px; font-weight: 800;">${new_status?.replace("_", " ").toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Validity:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${mou.start_date || "N/A"} to ${mou.end_date || "N/A"}</td>
                </tr>
              </table>
            </div>

            <a href="${appUrl}/mous/${mou.id}" 
               style="display: inline-block; background-color: #ED004F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 10px 0;">
              View Contract Details
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events & Catering. Automated System Notification.</p>
          </div>
        </div>
      `;
    } else {
      subject = `MOU Expiration Reminder: ${mou.title}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Critical Expiration Alert</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #fee2e2; color: #ef4444; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Action Required</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">MOU Expiring Soon</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">The MOU <strong>${mou.title}</strong> with <strong>${vendorName}</strong> is expiring in <strong>${days_until_expiration} days</strong>.</p>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fee2e2;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Expiration Date:</td>
                  <td style="padding: 8px 0; color: #991b1b; font-size: 14px; font-weight: 700;">${mou.end_date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Days Remaining:</td>
                  <td style="padding: 8px 0; color: #991b1b; font-size: 14px; font-weight: 700;">${days_until_expiration}</td>
                </tr>
              </table>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">Please initiate the renewal process or plan for contract termination to avoid operational disruption.</p>

            <a href="${appUrl}/mous/${mou.id}" 
               style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
              Manage MOU
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #fef2f2; border-top: 1px solid #fee2e2;">
            <p style="color: #991b1b; font-size: 12px; margin: 0; opacity: 0.7;">&copy; ${new Date().getFullYear()} Lazeez Events & Catering. Critical System Alert.</p>
          </div>
        </div>
      `;
    }

    console.log(`Sending email to ${recipientEmails.length} recipients`);

    const emailResponse = await resend.emails.send({
      from: "VORP <onboarding@resend.dev>",
      to: recipientEmails,
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-mou-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
