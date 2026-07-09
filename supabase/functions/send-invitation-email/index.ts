import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationEmailRequest {
  to: string
  token: string
  designation: string
  invitedBy: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, token, designation, invitedBy }: InvitationEmailRequest = await req.json()

    const invitationLink = `${Deno.env.get('PUBLIC_SITE_URL')}/set-password/${token}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Lazeez VORP <noreply@lazeezevents.com>',
        to: [to],
        subject: 'Welcome to Lazeez VORP - Complete Your Account Setup',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Lazeez VORP</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 40px 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  You've been invited to join <strong>Lazeez VORP</strong> (Vendor Operations & Resource Platform) by ${invitedBy}.
                </p>
                
                <div style="background: white; padding: 20px; border-left: 4px solid #E91E63; margin: 30px 0;">
                  <p style="margin: 0; font-size: 14px; color: #666;">Your Designation</p>
                  <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #E91E63;">${designation}</p>
                </div>
                
                <p style="font-size: 16px; margin-bottom: 30px;">
                  Click the button below to set your password and complete your account setup:
                </p>
                
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${invitationLink}" 
                     style="background: #E91E63; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(233, 30, 99, 0.3);">
                    Set Your Password
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 12px; color: #999; word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
                  ${invitationLink}
                </p>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
                  <p style="font-size: 12px; color: #999; margin: 0;">
                    This invitation will expire in 7 days. If you didn't expect this invitation, please ignore this email.
                  </p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                <p>© ${new Date().getFullYear()} Lazeez Events. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
