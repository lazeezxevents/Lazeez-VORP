# 🚀 Complete 100% Free Production Deployment & Custom Domain Guide for Lazeez VORP

This guide covers deploying **Lazeez VORP** fully **FREE forever** (no credit card required) with your custom domain **`vorp.lazeezevents.com`** and zero-downtime CI/CD automated deployments.

---

## 🏗️ Architecture Overview (Zero Cost)

1. **Frontend SPA (Vite + React)**: Hosted on **Vercel** (Free Tier forever, unlimited SSL & custom domains).
2. **Database, Auth & Real-Time Backend**: Hosted on **Supabase Free Tier** (500MB DB, 50,000 monthly active users, Built-in WebSocket real-time broadcast engine).

---

## 📌 Step 1: Backend (Supabase Free Tier)

Already configured and running at `https://mdxuyoklqiwjdeigbuzy.supabase.co`.

---

## 🌐 Step 2: Frontend Deployment on Vercel (100% Free)

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2. Import the `Lazeez-VORP` repository.
3. Add Environment Variables in Vercel Settings.
4. Click **Deploy**.

---

## 🏷️ Step 3: Custom Domain Setup (`vorp.lazeezevents.com`)

Add a CNAME record in your DNS provider:

| Field | Value |
| :--- | :--- |
| **Type** | `CNAME` |
| **Name** | `vorp` |
| **Target** | `cname.vercel-dns.com` |
| **TTL** | Auto |

---

## 🔄 Step 4: CI/CD (GitHub Actions)

The workflow at `.github/workflows/deploy.yml` auto-deploys on every push to `main`.

### Required GitHub Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GROQ_API_KEY`
