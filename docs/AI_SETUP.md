# AI Agent Setup Guide (Free & Open Source)

The Lazeez VORP Agent now supports multiple AI providers. We recommend **Groq** for the best performance (speed + smarts) using the open-source Llama 3 model.

---

## Option 1: Groq (Recommended - Best Performance)
**Model:** Llama 3 (Meta)
**Cost:** Free (Very generous beta tier)
**Speed:** Instant

1.  **Get Key:**
    *   Go to [console.groq.com](https://console.groq.com/keys).
    *   Sign up/Login.
    *   Click **Create API Key**.
    *   Copy the key (starts with `gsk_`).

2.  **Add to Supabase:**
    *   Go to Supabase Dashboard > Settings > Edge Functions.
    *   Add Secret: `GROQ_API_KEY`
    *   Value: *(Your copied key)*

---

## Option 2: Hugging Face (Open Source backup)
**Model:** Mixtral 8x7B
**Cost:** Free
**Speed:** Slower (shared infrastructure)

1.  **Get Key:**
    *   Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
    *   Create a new token (Access Type: `read`).
    *   Copy the token (starts with `hf_`).

2.  **Add to Supabase:**
    *   Go to Supabase Dashboard > Settings > Edge Functions.
    *   Add Secret: `HUGGINGFACE_API_KEY`
    *   Value: *(Your copied token)*

---

## Option 3: Google Gemini (Original)
**Model:** Gemini 1.5 Flash
**Cost:** Free Tier

1.  **Get Key:** [aistudio.google.com](https://aistudio.google.com/app/apikey)
2.  **Add Secret:** `GEMINI_API_KEY`

---

### fallback Mode
If you do not add *any* keys, the agent will continue to work in "Offline Mode" using simple keyword matching (no AI intelligence).
