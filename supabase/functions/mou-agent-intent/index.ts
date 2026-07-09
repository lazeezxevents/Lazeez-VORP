import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { query } = await req.json();
        if (!query) throw new Error("Query is required");

        // ------------------------------------------------------------------
        // CONFIGURATION: FREE AI PROVIDERS
        // ------------------------------------------------------------------
        const groqKey = Deno.env.get("GROQ_API_KEY");
        const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");

        // Common System Prompt for all models
        const systemPrompt = `You are an Agentic MOU Assistant for a company called 'Lazeez Events'.
        Your goal is to classify USER INTENT into JSON.
        
        Valid Intents:
        1. "extraction_intent": User wants to pull data from text/docs.
        2. "tracking_intent": User asks about dates, expiry, status.
        3. "suggestion": User asks for advice/recommendation.
        4. "vendor_intent": User mentions a specific vendor name.

        Response Format (JSON ONLY):
        {
          "type": "intent_type",
          "message": "A short, helpful response to the user.",
          "suggested_action": "relevant_action_name"
        }`;

        let result;

        // ------------------------------------------------------------------
        // OPTION 1: GROQ (BEST FREE OPTION - FAST & POWERFUL)
        // Uses Llama 3 (Open Source)
        // ------------------------------------------------------------------
        if (groqKey) {
            console.log("Using Groq (Llama 3)...");
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "llama3-8b-8192", // Extremely fast, free model
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: query }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" } // Enforce JSON
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Groq API Error: ${err}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            result = JSON.parse(content);
        }

        // ------------------------------------------------------------------
        // OPTION 2: HUGGING FACE (COMPLETELY FREE OPEN SOURCE)
        // Uses Mixtral or Zephyr via Inference API
        // ------------------------------------------------------------------
        else if (hfKey) {
            console.log("Using Hugging Face Inference API...");
            // We use a robust, free model endpoint. 
            // mistralai/Mixtral-8x7B-Instruct-v0.1 is a great choice.
            const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: `<s>[INST] ${systemPrompt} \n\n User Query: "${query}" [/INST] JSON Response:`,
                    parameters: {
                        max_new_tokens: 500,
                        return_full_text: false,
                        temperature: 0.1
                    }
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`HuggingFace API Error: ${err}`);
            }

            const data = await response.json();
            // HF returns an array: [{ generated_text: "..." }]
            let text = data[0]?.generated_text;

            // Clean up potentially messy output
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            // Sometimes models chatter before the JSON, try to find the first {
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                text = text.substring(jsonStart, jsonEnd + 1);
            }

            result = JSON.parse(text);
        }

        // ------------------------------------------------------------------
        // OPTION 3: GEMINI (GOOGLE FREE TIER)
        // ------------------------------------------------------------------
        else if (geminiKey) {
            console.log("Using Google Gemini...");
            const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
            const response = await fetch(`${geminiUrl}?key=${geminiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }]
                    }]
                }),
            });

            if (!response.ok) throw new Error(`Gemini API failed: ${response.status}`);
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            result = JSON.parse(text);
        }

        // ------------------------------------------------------------------
        // FALLBACK: NO KEYS CONFIGURED (OFFLINE MODE)
        // ------------------------------------------------------------------
        else {
            console.log("No API keys found. Using Offline Fallback Mode.");
            const lowerQuery = query.toLowerCase();

            if (lowerQuery.includes("extract")) {
                result = {
                    type: "extraction_intent",
                    message: "I'm ready to extract data from your documents (Offline Mode).",
                    suggested_action: "open_extraction_modal"
                };
            } else if (lowerQuery.includes("expire") || lowerQuery.includes("renew")) {
                result = {
                    type: "tracking_intent",
                    message: "I can check those dates for you (Offline Mode).",
                    suggested_action: "check_dates"
                };
            } else {
                result = {
                    type: "suggestion",
                    message: "I'm listening. Configure a free API key (Groq or HuggingFace) to make me smarter!",
                    suggested_action: "none"
                };
            }
        }

        // Return the final result
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("AI Agent Error:", error);
        return new Response(JSON.stringify({
            type: "error",
            message: "I had a bit of trouble connecting to my brain.",
            details: error.message
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
