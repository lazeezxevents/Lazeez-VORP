# Finance Module Deployment Guide

## Overview

This guide covers deploying the Finance Module to production, including prerequisites, deployment steps, post-deployment verification, and rollback procedures.

## Prerequisites

### System Requirements

**Backend:**
- Supabase project (PostgreSQL 15+)
- Node.js 18+ (for Edge Functions)
- Storage bucket configured

**Frontend:**
- Node.js 18+
- npm or yarn
- Build tools (Vite)

**Third-Party Services:**
- Email service (for notifications)
- Payment gateway (optional)
- Error tracking (Sentry recommended)

### Environment Setup

**Required Environment Variables:**

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Finance Module
FINANCE_RATE_LIMIT_MAX_REQUESTS=100
FINANCE_RATE_LIMIT_WINDOW_MS=60000
FINANCE_BACKUP_RETENTION_DAYS=30
FINANCE_BACKUP_RETENTION_MONTHS=84

# Optional
SENTRY_DSN=your_sentry_dsn
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

---

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled

---

## Deployment Steps

### Step 1: Database Migration

**1.1 Backup Current Database**

```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Or via SQL
pg_dump -h your-db-host -U postgres -d your-database > backup.sql
```

**1.2 Run Migrations**

```bash
# Navigate to project root
cd /path/to/lazeez-vorp

# Run all finance migrations in order
supabase db push

# Or manually apply each migration
psql -h your-db-host -U postgres -d your-database -f supabase/migrations/20260318_finance_core_schema.sql
psql -h your-db-host -U postgres -d your-database -f supabase/migrations/20260329_finance_vendor_profiles.sql
# ... continue for all migrations
```

**1.3 Verify Migrations**

```sql
-- Check all finance tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'finance_%'
ORDER BY table_name;

-- Verify RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'finance_%';

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%finance%';
```

### Step 2: Deploy Frontend

**2.1 Build Production Bundle**

```bash
# Install dependencies
npm install

# Run build
npm run build

# Verify build output
ls -lh dist/
```

**2.2 Deploy to Hosting**

**Option A: Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Option B: Netlify**

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

**Option C: Custom Server**

```bash
# Copy build to server
scp -r dist/* user@server:/var/www/lazeez-vorp/

# Configure nginx
sudo nano /etc/nginx/sites-available/lazeez-vorp

# Reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Configure Supabase

**3.1 Enable pg_cron (for automated backups)**

```sql
-- In Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily backup
SELECT cron.schedule(
  'finance-daily-backup',
  '0 2 * * *',
  'SELECT schedule_daily_backup()'
);

-- Schedule monthly backup
SELECT cron.schedule(
  'finance-monthly-backup',
  '0 3 1 * *',
  'SELECT schedule_monthly_backup()'
);

-- Schedule cleanup
SELECT cron.schedule(
  'finance-cleanup-backups',
  '0 4 * * *',
  'SELECT cleanup_expired_backups()'
);
```

**3.2 Configure Storage Bucket**

```bash
# Create receipts bucket
supabase storage create receipts

# Set bucket policies
supabase storage update receipts \
  --public false \
  --file-size-limit 10485760 \
  --allowed-mime-types "image/jpeg,image/png,application/pdf"
```

**3.3 Enable Realtime (optional)**

```sql
-- Enable realtime for finance tables
ALTER PUBLICATION supabase_realtime 
ADD TABLE finance_transactions,
ADD TABLE finance_invoices,
ADD TABLE finance_expenses;
```

### Step 4: Initialize Data

**4.1 Create Chart of Accounts**

```sql
-- Run initialization script
\i scripts/init_chart_of_accounts.sql
```

**4.2 Configure Tax Jurisdictions**

```sql
INSERT INTO finance_tax_jurisdictions (name, code, tax_type, rate, is_active)
VALUES ('Pakistan', 'PK', 'GST', 0.17, true);
```

**4.3 Set Up Initial Encryption Key**

```sql
-- Verify initial key exists
SELECT * FROM finance_encryption_keys WHERE version = 1;
```

### Step 5: Configure Security

**5.1 Enable RLS on All Tables**

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'finance_%';
```

**5.2 Configure Rate Limiting**

Already configured in code. Verify settings:

```typescript
// src/components/finance/RateLimiter.ts
DEFAULT_MAX_REQUESTS = 100
DEFAULT_WINDOW_MS = 60000 // 1 minute
```

**5.3 Set Up MFA for Admins**

```sql
-- Verify MFA tables exist
SELECT * FROM finance_mfa_settings LIMIT 1;
SELECT * FROM finance_mfa_attempts LIMIT 1;
```

---

## Post-Deployment Verification

### Smoke Tests

**1. Authentication**

```bash
# Test login
curl -X POST https://your-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

**2. Create Transaction**

```bash
# Test transaction creation
curl -X POST https://your-app.com/api/finance/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "revenue",
    "amount": 100,
    "description": "Test transaction"
  }'
```

**3. Generate Report**

```bash
# Test report generation
curl -X GET "https://your-app.com/api/finance/reports/pl?start=2026-01-01&end=2026-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Verification

```sql
-- Check data integrity
SELECT 
  SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) as total_debits,
  SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) as total_credits
FROM finance_ledger_entries;
-- Should be equal

-- Check RLS policies working
SET ROLE authenticated;
SELECT COUNT(*) FROM finance_transactions;
-- Should return only authorized records

-- Check audit logging
SELECT COUNT(*) FROM finance_audit_log 
WHERE created_at >= NOW() - INTERVAL '1 hour';
-- Should have recent entries
```

### Performance Tests

```bash
# Test transaction processing time
time curl -X POST https://your-app.com/api/finance/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"revenue","amount":100,"description":"Perf test"}'
# Should complete in < 100ms

# Test report generation time
time curl -X GET "https://your-app.com/api/finance/reports/pl?start=2026-01-01&end=2026-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should complete in < 2 seconds
```

### Security Verification

```bash
# Test rate limiting
for i in {1..110}; do
  curl -X GET https://your-app.com/api/finance/transactions \
    -H "Authorization: Bearer YOUR_TOKEN"
done
# Should get rate limit error after 100 requests

# Test RLS
curl -X GET https://your-app.com/api/finance/transactions \
  -H "Authorization: Bearer INVALID_TOKEN"
# Should get 401 Unauthorized
```

---

## Monitoring Setup

### Application Monitoring

**Sentry Integration:**

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
});
```

### Database Monitoring

**Enable pg_stat_statements:**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Monitor slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%finance_%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Backup Monitoring

```sql
-- Check backup status
SELECT 
  backup_type,
  status,
  created_at,
  completed_at,
  size
FROM finance_backups
ORDER BY created_at DESC
LIMIT 10;
```

---

## Rollback Procedures

### Emergency Rollback

**If deployment fails:**

**1. Rollback Frontend**

```bash
# Vercel
vercel rollback

# Netlify
netlify rollback

# Custom server
scp -r backup/dist/* user@server:/var/www/lazeez-vorp/
```

**2. Rollback Database**

```bash
# Restore from backup
psql -h your-db-host -U postgres -d your-database < backup.sql

# Or use Supabase point-in-time recovery
supabase db restore --time "2026-04-30T10:00:00Z"
```

**3. Verify Rollback**

```bash
# Test critical endpoints
curl https://your-app.com/api/health
curl https://your-app.com/api/finance/dashboard
```

### Partial Rollback

**If only specific features fail:**

**1. Disable Feature Flag**

```typescript
// src/config/features.ts
export const FINANCE_FEATURES = {
  AI_RECEIPT_EXTRACTION: false, // Disable problematic feature
  FRAUD_DETECTION: true,
  // ...
};
```

**2. Redeploy Frontend**

```bash
npm run build
vercel --prod
```

---

## Post-Deployment Tasks

### Day 1

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review audit logs
- [ ] Verify backups running
- [ ] Monitor user feedback

### Week 1

- [ ] Analyze usage patterns
- [ ] Review performance trends
- [ ] Check for any data anomalies
- [ ] Gather user feedback
- [ ] Document any issues

### Month 1

- [ ] Comprehensive performance review
- [ ] Security audit
- [ ] User satisfaction survey
- [ ] Optimization opportunities
- [ ] Update documentation

---

## Troubleshooting

### Common Deployment Issues

**Issue: Migration Fails**

```bash
# Check migration status
supabase migration list

# Repair migration
supabase migration repair

# Retry
supabase db push
```

**Issue: RLS Policies Not Working**

```sql
-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename LIKE 'finance_%';

-- Test policy
SET ROLE authenticated;
SET request.jwt.claims.sub = 'user-id';
SELECT * FROM finance_transactions;
```

**Issue: Build Fails**

```bash
# Clear cache
rm -rf node_modules dist .vite

# Reinstall
npm install

# Rebuild
npm run build
```

---

## Maintenance Windows

**Recommended Schedule:**
- Minor updates: Weekly, Sunday 2:00 AM - 4:00 AM UTC
- Major updates: Monthly, First Sunday 2:00 AM - 6:00 AM UTC
- Emergency patches: As needed with 1-hour notice

**Notification Template:**

```
Subject: Scheduled Maintenance - Finance Module

Dear Users,

The Finance Module will undergo scheduled maintenance:

Date: [DATE]
Time: [START] - [END] UTC
Duration: [DURATION]
Impact: [DESCRIPTION]

During this time, the Finance Module will be unavailable.

Thank you for your patience.

Lazeez VORP Team
```

---

## Support Contacts

**Deployment Team:**
- Lead: [Name] - [Email]
- DevOps: [Name] - [Email]
- Database: [Name] - [Email]

**Emergency Contacts:**
- On-call: [Phone]
- Escalation: [Manager Phone]

---

*Last Updated: April 30, 2026*
*Version: 1.0*
