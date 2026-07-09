// Centralized Groq API Client for Lazeez Events
// Uses Llama 3 8B or 70B for fast, free inference directly from the browser

export interface GroqMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Using 8b for lightning fast extraction/classification. Revert to a supported model.
const DEFAULT_MODEL = "llama-3.1-8b-instant";

/**
 * Ensures the app has a Groq key configured in .env
 */
export function isGroqConfigured(): boolean {
    const key = import.meta.env.VITE_GROQ_API_KEY?.trim();
    return !!key && key !== "your_groq_api_key_here";
}

/**
 * Ensures the app has a Groq key configured in .env
 */
function getApiKey(): string {
    const key = import.meta.env.VITE_GROQ_API_KEY?.trim();
    if (!isGroqConfigured()) {
        throw new Error(
            "Missing Groq API Key. Please get a free key from console.groq.com and add it to .env as VITE_GROQ_API_KEY."
        );
    }
    return key;
}

/**
 * Safely extracts JSON from an LLM response string, handling markdown blocks if present.
 */
function extractJSON(text: string): any {
    try {
        // 1. First try direct parsing (in case it is perfectly clean JSON)
        return JSON.parse(text);
    } catch (e) {
        // 2. Try removing markdown blocks like ```json ... ```
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (innerError) {
                // Fallback to strict regex extraction if markdown parsing fails
            }
        }

        // 3. Fallback: try to find the first '{' and last '}'
        const startIndex = text.indexOf("{");
        const endIndex = text.lastIndexOf("}");
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const jsonStr = text.substring(startIndex, endIndex + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (regexError) {
                console.error("Strict JSON parse failed:", jsonStr);
            }
        }

        throw new Error("Could not parse valid JSON from AI response.\nResponse was:\n" + text.substring(0, 200) + "...");
    }
}

/**
 * Single-turn API call to Groq
 * @param systemPrompt The instruction set for the AI
 * @param userMessage The user's input/data
 * @param jsonMode If true, attempts to enforce JSON object output and returns a parsed object.
 */
export async function callGroq(
    systemPrompt: string,
    userMessage: string,
    jsonMode: boolean = false
): Promise<any> {
    const messages: GroqMessage[] = [
        { role: "system", content: systemPrompt }
    ];

    if (userMessage.trim()) {
        messages.push({ role: "user", content: userMessage });
    }

    return makeGroqRequest(messages, jsonMode);
}

/**
 * Multi-turn conversation call to Groq
 * @param systemPrompt The core system instruction
 * @param history Array of previous messages (must already be in GroqMessage format if possible, but we'll map them)
 * @param jsonMode If true, parses output as JSON
 */
export async function chatWithGroq(
    systemPrompt: string,
    history: { role: string; content: string }[],
    jsonMode: boolean = false
): Promise<any> {

    // Format history to strictly use allowed roles
    const formattedHistory: GroqMessage[] = history.map(msg => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
        content: msg.content || (msg as any).text || "" // handle various history formats just in case
    }));

    const messages: GroqMessage[] = [
        { role: "system", content: systemPrompt },
        ...formattedHistory
    ];

    return makeGroqRequest(messages, jsonMode);
}

/**
 * Internal helper to execute the fetch call
 */
async function makeGroqRequest(messages: GroqMessage[], jsonMode: boolean): Promise<any> {
    const apiKey = getApiKey();

    const body: any = {
        model: DEFAULT_MODEL,
        messages: messages,
        temperature: jsonMode ? 0.1 : 0.7, // Lower temperature for more deterministic JSON
    };

    // Groq supports a specific response_format for JSON mode
    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorText = errorData?.error?.message || await response.text();
        console.error("Groq API error:", errorText);

        // Groq rate limit specific error handling
        if (response.status === 429) {
            throw new Error("Groq API rate limit exceeded. Please wait a moment and try again.");
        }

        throw new Error(`Groq API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
        throw new Error("Groq returned an empty response");
    }

    if (jsonMode) {
        return extractJSON(textContent);
    }

    return textContent;
}
