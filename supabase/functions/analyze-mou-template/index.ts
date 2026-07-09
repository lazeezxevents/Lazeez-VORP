
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
        const { text, filename } = await req.json();
        const groqKey = Deno.env.get("GROQ_API_KEY");

        if (!groqKey) {
            throw new Error("GROQ_API_KEY not configured");
        }

        const systemPrompt = `You are an Expert Legal Document Architect. 
    Analyze the following raw text from an MOU document and "learn" its structure.
    
    TASKS:
    1. Identify all dynamic placeholders that need to be filled (e.g., Party Names, Addresses, Dates, Bank Details, Commission, Term).
    2. Extract the static "Legal Language" around these placeholders for context.
    3. Identify where a "Logo" or "Signature" would likely belong.
    4. Categorize the MOU type (e.g., Caterer, Restaurant, Home Chef).
    
    RESPONSE FORMAT (JSON ONLY):
    {
      "mou_type": "string",
      "placeholders": [
        { "id": "placeholder_name", "type": "text | number | date", "context": "surrounding text snippet" }
      ],
      "branding": {
        "logo_suggested_y": "top | bottom",
        "has_tables": boolean
      },
      "summary": "Short description of what you learned from this document."
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
                    { role: "user", content: `Filename: ${filename}\nDocument Text:\n${text}` }
                ],
                temperature: 0.1,
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
