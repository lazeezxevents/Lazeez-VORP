import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface PaymentNotificationRequest {
  payment_id: string;
  notification_type: "upfront_paid" | "remaining_released" | "payment_created";
  vendor_id?: string;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { payment_id, notification_type, vendor_id }: PaymentNotificationRequest = await req.json();

    console.log(`Processing ${notification_type} notification for payment ${payment_id}`);

    // Fetch payment details with vendor
    const { data: payment, error: paymentError } = await supabase
      .from("vendor_payments")
      .select(`
        *,
        vendor:vendors(id, name, contact_person, email)
      `)
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      console.error("Error fetching payment:", paymentError);
      throw new Error(`Payment not found: ${payment_id}`);
    }

    // Get staff emails
    const { data: staffUsers, error: staffError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        profiles:user_id(email, full_name)
      `)
      .in("role", ["admin", "ops_manager"]);

    let recipients: string[] = [];
    if (!staffError && staffUsers) {
      recipients = staffUsers
        .map((u: any) => u.profiles?.email)
        .filter(Boolean);
    }

    let subject = "";
    let htmlContent = "";

    const formatAmount = (amount: number) => `PKR ${amount.toLocaleString()}`;
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || 'https://lazeez-vorp.vercel.app';

    if (notification_type === "upfront_paid") {
      subject = `💰 Upfront Payment Released: ${payment.order_id}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Finance & Disbursement</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Payment Release</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">Upfront Released</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">The upfront disbursement for Order <strong>#${payment.order_id}</strong> has been successfully processed.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vendor:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${payment.vendor?.name || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Disbursement:</td>
                  <td style="padding: 8px 0; color: #ED004F; font-size: 20px; font-weight: 800;">${formatAmount(payment.upfront_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Remaining:</td>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${formatAmount(payment.remaining_amount)}</td>
                </tr>
              </table>
            </div>

            <a href="${appUrl}/finance" 
               style="display: inline-block; background-color: #ED004F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 10px 0;">
              View Ledger
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events. Secured Financial Transmission.</p>
          </div>
        </div>
      `;
    } else if (notification_type === "remaining_released") {
      subject = `✅ Final Payment Released: ${payment.order_id}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #059669; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Settlement Confirmed</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #dcfce7; color: #059669; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Final Settlement</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">Order Fully Settled</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">The remaining balance for Order <strong>#${payment.order_id}</strong> has been released.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vendor:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${payment.vendor?.name || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total Order:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${formatAmount(payment.order_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Final Release:</td>
                  <td style="padding: 8px 0; color: #059669; font-size: 20px; font-weight: 800;">${formatAmount(payment.remaining_amount)}</td>
                </tr>
              </table>
            </div>

            <p style="color: #059669; font-weight: 700; text-align: center; font-size: 14px; margin: 15px 0;">🎉 Transaction Lifecycle Complete</p>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events. Settlement Records finalized.</p>
          </div>
        </div>
      `;
    } else if (notification_type === "payment_created") {
      subject = `📝 New Payment Created: ${payment.order_id}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lazeez VORP</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Liability Recorded</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <div style="margin-bottom: 25px;">
              <span style="background-color: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase;">Financial Integrity</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 15px 0; font-size: 20px;">New Payment Record</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">A new financial record has been established for Order <strong>#${payment.order_id}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total Order:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${formatAmount(payment.order_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Commission (${payment.commission_percentage || 0}%):</td>
                  <td style="padding: 8px 0; color: #ED004F; font-size: 14px; font-weight: 700;">${formatAmount(payment.commission_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Net Payable:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${formatAmount(payment.payable_amount)}</td>
                </tr>
              </table>
            </div>

            <a href="${appUrl}/finance" 
               style="display: inline-block; background-color: #ED004F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 10px 0;">
              View in Ledger
            </a>
          </div>
          <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Lazeez Events. Professional Financial Services.</p>
          </div>
        </div>
      `;
    }

    if (recipients.length > 0) {
      console.log(`Sending email to ${recipients.length} recipients`);
      
      const { error: emailError } = await resend.emails.send({
        from: "Lazeez VORP <notifications@resend.dev>",
        to: recipients,
        subject,
        html: htmlContent,
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        throw emailError;
      }

      console.log("Email sent successfully");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-payment-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
