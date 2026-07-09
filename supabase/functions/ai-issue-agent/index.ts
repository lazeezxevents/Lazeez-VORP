import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { issue_id } = await req.json();
    if (!issue_id) throw new Error("issue_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch issue details
    const { data: issue, error: issueErr } = await supabase
      .from("issues")
      .select("*, vendor:vendors(name, category, status, rating, commission_percentage)")
      .eq("id", issue_id)
      .single();

    if (issueErr || !issue) throw new Error("Issue not found");

    // Fetch vendor history in parallel
    const vendorId = issue.vendor_id;
    const [pastIssues, remarks, payments, assignments, auditLogs] = await Promise.all([
      vendorId
        ? supabase.from("issues").select("id, title, priority, status, created_at, resolved_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10)
        : { data: [] },
      vendorId
        ? supabase.from("vendor_remarks").select("remark, remark_type, created_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10)
        : { data: [] },
      vendorId
        ? supabase.from("vendor_payments").select("order_id, order_amount, payment_status, created_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10)
        : { data: [] },
      vendorId
        ? supabase.from("employee_vendor_assignments").select("employee_id, assigned_at").eq("vendor_id", vendorId)
        : { data: [] },
      supabase.from("audit_logs").select("action, old_values, new_values, created_at").eq("entity_id", issue_id).eq("entity_type", "issue").order("created_at", { ascending: false }).limit(10),
    ]);

    // Get team member profiles for assignments
    let teamMembers: any[] = [];
    if (assignments.data && assignments.data.length > 0) {
      const empIds = assignments.data.map((a: any) => a.employee_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", empIds);
      teamMembers = profiles || [];
    }

    const context = {
      issue: {
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        status: issue.status,
        due_date: issue.due_date,
        created_at: issue.created_at,
      },
      vendor: issue.vendor ? {
        name: issue.vendor.name,
        category: issue.vendor.category,
        status: issue.vendor.status,
        rating: issue.vendor.rating,
        commission: issue.vendor.commission_percentage,
      } : null,
      pastIssues: (pastIssues.data || []).map((i: any) => ({
        title: i.title,
        priority: i.priority,
        status: i.status,
        created: i.created_at,
        resolved: i.resolved_at,
      })),
      remarks: (remarks.data || []).map((r: any) => ({
        remark: r.remark,
        type: r.remark_type,
        date: r.created_at,
      })),
      payments: (payments.data || []).map((p: any) => ({
        orderId: p.order_id,
        amount: p.order_amount,
        status: p.payment_status,
        date: p.created_at,
      })),
      teamMembers: teamMembers.map((t: any) => ({
        name: t.full_name || t.email,
        department: t.department,
      })),
      auditTrail: (auditLogs.data || []).map((l: any) => ({
        action: l.action,
        date: l.created_at,
      })),
    };

    const systemPrompt = `You are an AI operations assistant for Lazeez Events, a food and events platform. Analyze the issue and provide actionable guidance.

Given the full context (issue details, vendor history, past issues, remarks, payments, team assignments, audit trail), respond with a structured analysis.

Use the analyze_issue tool to return your analysis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this issue and its full context:\n\n${JSON.stringify(context, null, 2)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_issue",
              description: "Return structured issue analysis with recommendations",
              parameters: {
                type: "object",
                properties: {
                  severity_assessment: { type: "string", description: "Brief severity assessment (1-2 sentences)" },
                  root_cause: { type: "string", description: "Likely root cause based on context" },
                  vendor_history_summary: { type: "string", description: "Summary of vendor's past issues and patterns" },
                  difficulty_level: { type: "string", enum: ["easy", "moderate", "complex", "critical"], description: "How difficult this issue is to resolve" },
                  recommended_actions: {
                    type: "array",
                    items: { type: "object", properties: { step: { type: "string" }, priority: { type: "string", enum: ["immediate", "short_term", "long_term"] } }, required: ["step", "priority"] },
                    description: "Ordered list of recommended actions"
                  },
                  suggested_status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"], description: "Recommended status change" },
                  suggested_assignee: { type: "string", description: "Recommended team member name or 'unassigned'" },
                  resolution_remark: { type: "string", description: "Suggested remark to add to the vendor" },
                  risk_factors: { type: "array", items: { type: "string" }, description: "Key risk factors to watch" },
                },
                required: ["severity_assessment", "root_cause", "vendor_history_summary", "difficulty_level", "recommended_actions", "suggested_status", "resolution_remark", "risk_factors"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_issue" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) throw new Error("AI did not return analysis");

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ analysis, context: { vendorName: context.vendor?.name, issueTitle: context.issue.title } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-issue-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});