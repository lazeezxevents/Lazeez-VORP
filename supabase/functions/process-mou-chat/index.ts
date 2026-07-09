
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { messages, category, templateId } = await req.json();
        const groqKey = Deno.env.get("GROQ_API_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!groqKey) throw new Error("GROQ_API_KEY not configured");

        let templateContext = "";
        if (templateId) {
            const response = await fetch(`${supabaseUrl}/rest/v1/mou_templates?id=eq.${templateId}&select=structure_json,raw_text`, {
                headers: { "apikey": supabaseKey!, "Authorization": `Bearer ${supabaseKey}` }
            });
            const templates = await response.json();
            if (templates && templates[0]) {
                templateContext = `
                I have "LEARNED" this specific template structure from a sample upload:
                - Placeholders identified: ${JSON.stringify(templates[0].structure_json)}
                - Text Context: ${templates[0].raw_text.substring(0, 500)}...
                PLEASE MAP THE USER DETAILS TO THESE IDENTIFIED PLACEHOLDERS.`;
            }
        }

        const systemPrompt = `You are a Conversational Legal Assistant for Lazeez Events.
    Your goal is to talk to the user naturally and collect/extract data for an MOU.
    
    Category: ${category}
    ${templateContext}

    MANDATORY FIELDS TO TRACK:
    1. owner_name
    2. cnic
    3. business_name
    4. bank_details {title, iban, bank_name}
    5. menu (Array of products)
    6. address
    7. commission
    8. subscription {cost, threshold_orders}
    9. term_months

    YOUR TASK:
    1. Analyze the conversation history.
    2. Extract any of the mandatory fields found. Use null if not found yet.
    3. Provide a natural, professional response to the user. 
       - If they just gave info, acknowledge it and ask for the next missing piece.
       - If they ask a question, answer it.
       - Be helpful and extremely professional. No sci-fi jargon.

    RESPONSE FORMAT (JSON ONLY):
    {
      "extracted_data": { ... },
      "response": "Your spoken response to the user"
    }`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages.map((m: any) => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.text
                    }))
                ],
                temperature: 0.5,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Error: ${err}`);
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
