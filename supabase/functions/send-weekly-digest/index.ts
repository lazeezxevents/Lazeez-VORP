import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Generating Weekly Digest for all opted-in users...");

    // 1. Fetch users who opted in for weekly_digest
    const { data: optedUsers, error: userError } = await supabase
      .from("notification_preferences")
      .select("user_id, profiles(email, full_name)")
      .eq("weekly_digest", true);

    if (userError || !optedUsers) {
      console.log("No users opted into weekly digest.");
      return new Response(JSON.stringify({ message: "No users to notify" }), { status: 200 });
    }

    // 2. Fetch stats for the last 7 days
    const now = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString();

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString();

    // -- Basic Counts --
    const { count: newVendors } = await supabase.from("vendors").select("*", { count: 'exact', head: true }).gt("created_at", lastWeekStr);
    const { count: resolvedIssues } = await supabase.from("issues").select("*", { count: 'exact', head: true }).eq("status", "resolved").gt("updated_at", lastWeekStr);
    const { count: signedMous } = await supabase.from("mous").select("*", { count: 'exact', head: true }).eq("status", "signed").gt("updated_at", lastWeekStr);

    // -- Project & Task Velocity --
    const { count: newProjects } = await supabase.from("projects").select("*", { count: 'exact', head: true }).gt("created_at", lastWeekStr);
    const { count: completedTasks } = await supabase.from("project_tasks").select("*", { count: 'exact', head: true }).eq("status", "done").gt("updated_at", lastWeekStr);
    
    // -- Milestones --
    const { count: achievedMilestones } = await supabase.from("milestones").select("*", { count: 'exact', head: true }).eq("status", "completed").gt("updated_at", lastWeekStr);
    const { count: upcomingMilestones } = await supabase.from("milestones").select("*", { count: 'exact', head: true }).neq("status", "completed").lte("target_date", nextWeekStr).gte("target_date", now.toISOString());

    // -- Performance Highlight --
    const { data: attendanceData } = await supabase.from("attendance_logs" as any).select("status").gt("check_in", lastWeekStr);
    const attendanceCount = attendanceData?.length || 0;
    const presentCount = attendanceData?.filter((l: any) => l.status === 'present').length || 0;
    const attendanceAvg = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 100;

    // 3. Send emails
    for (const entry of optedUsers) {
      const profile = (entry.profiles as any);
      if (!profile?.email) continue;

      await resend.emails.send({
        from: "Lazeez VORP <digest@resend.dev>",
        to: [profile.email],
        subject: "📊 Your Weekly Operational Digest",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #fcfcfc;">
            <div style="background-color: #0f172a; padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">Lazeez VORP</h1>
              <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Weekly Intelligence Summary</p>
            </div>
            
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Operational Velocity</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.5;">Hi ${profile.full_name || "Team Member"}, here is your performance wrap-up for the last 7 days.</p>
              
              <!-- Primary KPIs -->
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 25px 0;">
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #f1f5f9;">
                  <p style="margin: 0; font-size: 24px; font-weight: 800; color: #ED004F;">${completedTasks || 0}</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Tasks Done</p>
                </div>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #f1f5f9;">
                  <p style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${achievedMilestones || 0}</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Milestones</p>
                </div>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #f1f5f9;">
                  <p style="margin: 0; font-size: 24px; font-weight: 800; color: #22c55e;">${attendanceAvg}%</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Attendance</p>
                </div>
              </div>

              <!-- Secondary Details -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid #f1f5f9;">
                <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Ecosystem Growth</h3>
                <table style="width: 100%; font-size: 14px; color: #475569;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">New Vendors Onboarded</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0f172a;">+${newVendors || 0}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Active Projects Launched</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0f172a;">${newProjects || 0}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Upcoming Milestones (7d)</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #ED004F;">${upcomingMilestones || 0}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">Issues Successfully Resolved</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #22c55e;">${resolvedIssues || 0}</td>
                  </tr>
                </table>
              </div>

              <div style="background: linear-gradient(to right, #ED004F, #cc0044); padding: 20px; border-radius: 12px; color: white; text-align: center;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500;">Ready to start your next operational week?</p>
                <a href="${Deno.env.get("PUBLIC_APP_URL") || 'https://lazeez-vorp.vercel.app'}" style="display: inline-block; background-color: white; color: #ED004F; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  Open Operation Dashboard
                </a>
              </div>
            </div>
            
            <div style="padding: 30px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0 0 10px 0; line-height: 1.6;">You are receiving this summary because you opted into the weekly digest in your Lazeez VORP settings. Operational data is calculated for the period of 7 days prior to today.</p>
              <p style="color: #64748b; font-size: 11px; font-weight: 700; margin: 0; text-transform: uppercase;">&copy; ${new Date().getFullYear()} Lazeez Events & Catering</p>
            </div>
          </div>
        `
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

serve(handler);
