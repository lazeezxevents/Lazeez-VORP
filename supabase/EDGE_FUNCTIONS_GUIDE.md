# ⚡ Supabase Edge Functions Guide

Since you asked: **"how edge function are created will i need to also create them in new database? if yes how"**

**Answer:** No, you do NOT create Edge Functions in the database SQL editor. They are **TypeScript code** that runs on Supabase's servers, not inside the database. They must be **deployed** using the Supabase CLI.

I have already written the code for them in `supabase/functions/`.

## 1. Setup Your Local Environment (One Time)

Make sure you have the Supabase CLI installed and logged in.

```powershell
# Check if you have CLI
supabase --version

# If not, install via Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Login to your new project
supabase login
supabase link --project-ref mdxuyoklqiwjdeigbuzy
```

*(Note: Replace `mdxuyoklqiwjdeigbuzy` with your actual project Ref ID if distinct, but I see this ID in your config)*

## 2. Set Secrets (Required for AI)

Your functions need the API keys to work. Run this command:

```powershell
supabase secrets set LOVABLE_API_KEY="your_lovable_key_here" SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

## 3. Deploy the Functions

Run this command to deploy all functions at once:

```powershell
supabase functions deploy
```

This will compile the TypeScript code in `supabase/functions/` and upload it to your Supabase project.

## 4. How They Work

- **Where is the code?**
  Inside `supabase/functions/extract-mou-data/index.ts` (and other folders).
- **How does the app call them?**
  The `supabase-js` client in your React app calls them like this:
  
  ```ts
  const { data } = await supabase.functions.invoke('extract-mou-data', {
    body: { documentText: "..." }
  })
  ```

That's it! You don't need to do anything in the SQL Editor for Edge Functions.
