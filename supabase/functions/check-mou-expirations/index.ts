import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log("Checking for expiring MOUs and Legacy transitions...");

    // 1. Mark Legacy Status for old MOUs/Vendors
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

    // Mark MOUs as legacy if they are old and NOT renewed
    const { error: legacyMouError } = await supabase
      .from("mous")
      .update({ status: "legacy" })
      .lt("end_date", new Date().toISOString().split("T")[0])
      .neq("status", "legacy");

    if (legacyMouError) console.error("Error updating legacy MOUs:", legacyMouError);

    // Mark Vendors as legacy if their newest MOU is legacy
    // (Simplified: if a vendor has no active/approved/signed MOUs but has legacy ones)
    const { data: legacyVendors } = await supabase.rpc('get_vendors_with_only_legacy_mous');
    if (legacyVendors?.length) {
      await supabase
        .from("vendors")
        .update({ status: "legacy" })
        .in("id", legacyVendors.map((v: any) => v.id));
    }

    // 2. Handle Auto-Renewal
    // Find MOUs that have auto-renewal and are expiring today or tomorrow
    const { data: renewingMous } = await supabase
      .from("mous")
      .select("*, vendors(*)")
      .eq("end_date", new Date().toISOString().split("T")[0])
      .contains("terms", { auto_renewal: true });

    for (const mou of renewingMous || []) {
      console.log(`Auto-renewing MOU ${mou.id} for vendor ${mou.vendor_id}`);

      const newEndDate = new Date(mou.end_date);
      newEndDate.setMonth(newEndDate.getMonth() + 3);

      await supabase.from("mous").insert({
        vendor_id: mou.vendor_id,
        title: `${mou.title} (Renewed)`,
        status: "approved",
        start_date: mou.end_date,
        end_date: newEndDate.toISOString().split("T")[0],
        terms: mou.terms,
        document_url: mou.document_url
      });

      // Mark old one as legacy
      await supabase.from("mous").update({ status: "legacy" }).eq("id", mou.id);
    }

    // 3. Expiration Notifications (Original logic)
    const today = new Date();
    const reminderDays = [7, 14, 30];

    let notificationsSent = 0;

    for (const days of reminderDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const { data: expiringMous, error } = await supabase
        .from("mous")
        .select("id, title")
        .eq("end_date", targetDateStr)
        .in("status", ["approved", "signed"]);

      if (error) {
        console.error(`Error fetching MOUs expiring in ${days} days:`, error);
        continue;
      }

      console.log(`Found ${expiringMous?.length || 0} MOUs expiring in ${days} days`);

      for (const mou of expiringMous || []) {
        // Call the notification function
        const { error: invokeError } = await supabase.functions.invoke("send-mou-notification", {
          body: {
            mou_id: mou.id,
            notification_type: "expiration_reminder",
            days_until_expiration: days,
          },
        });

        if (invokeError) {
          console.error(`Failed to send notification for MOU ${mou.id}:`, invokeError);
        } else {
          notificationsSent++;
          console.log(`Sent expiration reminder for MOU ${mou.title}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked for expiring MOUs. Sent ${notificationsSent} notifications.`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-mou-expirations function:", error);
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
