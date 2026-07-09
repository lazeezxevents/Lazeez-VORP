# Finance Module Administrator Guide

## Overview

This guide is for Finance Administrators who manage the Finance Module configuration, security, and maintenance. It covers system setup, user management, security hardening, and troubleshooting.

## Table of Contents

1. [System Configuration](#system-configuration)
2. [User Management](#user-management)
3. [Security Administration](#security-administration)
4. [Backup and Recovery](#backup-and-recovery)
5. [Performance Monitoring](#performance-monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance Tasks](#maintenance-tasks)

---

## System Configuration

### Initial Setup

**1. Chart of Accounts**

Set up your chart of accounts structure:

```sql
-- Example: Create main account categories
INSERT INTO finance_accounts (code, name, type, parent_account_id) VALUES
  ('1000', 'Assets', 'asset', NULL),
  ('1100', 'Current Assets', 'asset', '1000'),
  ('1110', 'Cash', 'asset', '1100'),
  ('2000', 'Liabilities', 'liability', NULL),
  ('3000', 'Equity', 'equity', NULL),
  ('4000', 'Revenue', 'revenue', NULL),
  ('5000', 'Expenses', 'expense', NULL);
```

**2. Tax Jurisdictions**

Configure tax rules for your region:

```typescript
import { ComplianceTaxManager } from '@/components/finance/ComplianceTaxManager';

const taxManager = ComplianceTaxManager.getInstance();

await taxManager.createJurisdiction({
  name: 'Pakistan',
  code: 'PK',
  taxType: 'GST',
  rate: 0.17,
  isActive: true
});
```

**3. Commission Rules**

Set default commission structures:

```typescript
// Flat rate commission
{
  model: 'flat',
  amount: 50
}

// Percentage commission
{
  model: 'percentage',
  rate: 0.15
}

// Tiered commission
{
  model: 'tiered',
  tiers: [
    { threshold: 0, rate: 0.10 },
    { threshold: 1000, rate: 0.12 },
    { threshold: 5000, rate: 0.15 }
  ]
}
```

**4. Subscription Plans**

Configure vendor subscription plans:

```typescript
const plans = [
  {
    name: 'Basic',
    price: 49.99,
    billingCycle: 'monthly',
    orderThreshold: 50
  },
  {
    name: 'Premium',
    price: 99.99,
    billingCycle: 'monthly',
    orderThreshold: 100
  },
  {
    name: 'Enterprise',
    price: 999.99,
    billingCycle: 'annual',
    orderThreshold: 1000
  }
];
```

---

## User Management

### Role-Based Access Control

**Finance Admin**
- Full access to all features
- Can configure system settings
- Can manage users and permissions
- Can view all financial data

**Finance Staff**
- Can create and view transactions
- Can manage invoices and expenses
- Can generate reports
- Cannot modify system configuration

**Manager**
- Can view department budgets
- Can approve expenses
- Can view department reports
- Cannot create journal entries

**Employee**
- Can submit expenses
- Can view personal reimbursements
- Cannot access financial reports

### Adding Users

```sql
-- Grant finance admin role
UPDATE users 
SET role = 'admin'
WHERE email = 'finance.admin@lazeez.com';

-- Grant finance staff role
UPDATE users 
SET role = 'staff'
WHERE email = 'finance.staff@lazeez.com';
```

### Permission Management

Permissions are enforced through Row-Level Security (RLS) policies. Review policies in:
```
supabase/migrations/20260426_finance_rls_policies.sql
```

---

## Security Administration

### Multi-Factor Authentication

**Enabling MFA for Finance Admins**

MFA is required for all Finance Admin users.

**Setup Process:**

1. User navigates to Settings → Security
2. Clicks "Enable MFA"
3. Scans QR code with authenticator app
4. Enters verification code
5. Saves backup codes securely

**Disabling MFA (Emergency Only):**

```sql
UPDATE finance_mfa_settings
SET is_enabled = false
WHERE user_id = '[USER_ID]';
```

### Rate Limiting

**Default Limits:**
- General endpoints: 100 requests/minute
- Payout operations: 50 requests/minute
- Report generation: 30 requests/minute

**Viewing Rate Limit Violations:**

```sql
SELECT 
  u.email,
  v.endpoint,
  v.request_count,
  v.violated_at
FROM finance_rate_limit_violations v
JOIN users u ON u.id = v.user_id
WHERE v.violated_at >= NOW() - INTERVAL '24 hours'
ORDER BY v.violated_at DESC;
```

**Adjusting Rate Limits:**

Modify limits in `RateLimiter.ts`:

```typescript
const { allowed } = await limiter.checkLimit(
  userId,
  endpoint,
  { maxRequests: 200 } // Custom limit
);
```

### Encryption Key Management

**Key Rotation Schedule:**
- Rotate encryption keys every 90 days
- Keep previous keys for decryption
- Test decryption after rotation

**Rotating Keys:**

```sql
SELECT rotate_encryption_key();
```

**Re-encrypting Data:**

```typescript
import { EncryptionService } from '@/components/finance/EncryptionService';

const encryption = EncryptionService.getInstance();
await encryption.rotateKey();

// Re-encrypt existing data
// This should be done in batches for large datasets
```

### Audit Log Review

**Daily Audit Tasks:**

```sql
-- Review high-value transactions
SELECT *
FROM finance_audit_log
WHERE entity_type = 'transaction'
AND (new_values->>'amount')::numeric > 10000
AND changed_at >= CURRENT_DATE;

-- Review permission changes
SELECT *
FROM finance_audit_log
WHERE entity_type = 'user'
AND action = 'update'
AND old_values->>'role' != new_values->>'role';

-- Review failed login attempts
SELECT *
FROM finance_mfa_attempts
WHERE success = false
AND attempted_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) >= 3;
```

---

## Backup and Recovery

### Backup Configuration

**Automated Backups:**
- Daily backups: 2:00 AM UTC (30-day retention)
- Monthly backups: 1st of month, 3:00 AM UTC (7-year retention)
- Cleanup: Daily at 4:00 AM UTC

**Configuring Backup Schedule:**

```typescript
import { BackupRecoveryService } from '@/components/finance/BackupRecoveryService';

const backup = BackupRecoveryService.getInstance();

await backup.configureBackupSchedule({
  frequency: 'daily',
  retentionDays: 30,
  retentionMonths: 84,
  enabled: true
});
```

### Manual Backups

**Creating Manual Backup:**

```typescript
const backupId = await backup.createManualBackup('Pre-migration backup');
console.log(`Backup created: ${backupId}`);
```

**Verifying Backup:**

```typescript
const isValid = await backup.verifyBackupIntegrity(backupId);
if (!isValid) {
  console.error('Backup integrity check failed');
}
```

### Recovery Procedures

**Full System Recovery:**

```typescript
// 1. List available backups
const backups = await backup.listBackups();

// 2. Select recovery point
const recoveryPoint = backups[0];

// 3. Restore
await backup.restoreFromBackup(recoveryPoint.id);
```

**Point-in-Time Recovery:**

```typescript
const targetTime = new Date('2026-04-15T10:30:00Z');
await backup.pointInTimeRecovery(targetTime);
```

**See also:** [Disaster Recovery Procedures](./FINANCE_DISASTER_RECOVERY.md)

---

## Performance Monitoring

### Key Metrics

**Transaction Processing Time**
- Target: < 100ms
- Alert threshold: > 200ms

**Report Generation Time**
- Target: < 2 seconds
- Alert threshold: > 5 seconds

**Dashboard Load Time**
- Target: < 500ms (with caching)
- Alert threshold: > 1 second

### Monitoring Queries

**Slow Transactions:**

```sql
SELECT 
  transaction_number,
  type,
  amount,
  created_at,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM finance_transactions
WHERE completed_at - created_at > INTERVAL '200 milliseconds'
ORDER BY duration_seconds DESC
LIMIT 20;
```

**Database Performance:**

```sql
-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'finance_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'finance_%'
ORDER BY idx_scan DESC;
```

### Cache Management

**Clearing Cache:**

```typescript
// Clear report cache
await supabase.rpc('clear_report_cache');

// Clear dashboard cache
await supabase.rpc('clear_dashboard_cache');
```

**Cache Hit Rate:**

```sql
SELECT 
  'report_cache' as cache_type,
  COUNT(*) FILTER (WHERE cache_hit = true) as hits,
  COUNT(*) FILTER (WHERE cache_hit = false) as misses,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit = true) / COUNT(*), 2) as hit_rate
FROM finance_cache_stats
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

---

## Troubleshooting

### Common Issues

**Issue: Unbalanced Journal Entries**

**Symptoms:** Error when creating journal entry

**Solution:**
```sql
-- Find unbalanced entries
SELECT 
  je.id,
  je.entry_number,
  SUM(le.debit) as total_debit,
  SUM(le.credit) as total_credit,
  SUM(le.debit) - SUM(le.credit) as difference
FROM finance_journal_entries je
JOIN finance_ledger_entries le ON le.journal_entry_id = je.id
GROUP BY je.id, je.entry_number
HAVING SUM(le.debit) != SUM(le.credit);

-- Fix by creating correcting entry
```

**Issue: Invoice Not Updating Status**

**Symptoms:** Invoice shows wrong status after payment

**Solution:**
```sql
-- Recalculate invoice status
UPDATE finance_invoices
SET status = CASE
  WHEN amount_paid = 0 THEN 'pending'
  WHEN amount_paid >= total_amount THEN 'paid'
  WHEN amount_paid > 0 THEN 'partially_paid'
  ELSE status
END
WHERE id = '[INVOICE_ID]';
```

**Issue: Receipt AI Extraction Failing**

**Symptoms:** Receipts stuck in processing

**Solution:**
1. Check Tesseract.js worker status
2. Verify image format (PDF, JPG, PNG only)
3. Check file size (< 10MB)
4. Retry extraction manually

**Issue: Rate Limit False Positives**

**Symptoms:** Users blocked incorrectly

**Solution:**
```typescript
import { RateLimiter } from '@/components/finance/RateLimiter';

const limiter = RateLimiter.getInstance();
limiter.reset(userId, endpoint);
```

### Debug Mode

Enable debug logging:

```typescript
// In development
localStorage.setItem('finance_debug', 'true');

// Check logs
console.log('Finance debug logs:', 
  JSON.parse(localStorage.getItem('finance_debug_logs') || '[]')
);
```

### Error Tracking

**Viewing Recent Errors:**

```sql
SELECT 
  error_type,
  error_message,
  COUNT(*) as occurrences,
  MAX(created_at) as last_occurrence
FROM finance_error_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_type, error_message
ORDER BY occurrences DESC;
```

---

## Maintenance Tasks

### Daily Tasks

- [ ] Review backup completion status
- [ ] Check rate limit violations
- [ ] Review high-value transactions
- [ ] Monitor system performance metrics

### Weekly Tasks

- [ ] Review audit logs
- [ ] Check database performance
- [ ] Verify data integrity
- [ ] Review user access logs

### Monthly Tasks

- [ ] Generate compliance reports
- [ ] Review and update budgets
- [ ] Analyze system usage patterns
- [ ] Update documentation
- [ ] Test disaster recovery procedures

### Quarterly Tasks

- [ ] Rotate encryption keys
- [ ] Conduct security audit
- [ ] Review and update RLS policies
- [ ] Performance optimization review
- [ ] User access review

### Annual Tasks

- [ ] Archive old data
- [ ] Review retention policies
- [ ] Update tax configurations
- [ ] Comprehensive system audit
- [ ] Disaster recovery drill

### Data Integrity Checks

**Run Monthly:**

```sql
-- Check accounting equation balance
SELECT 
  SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) as total_debits,
  SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) as total_credits,
  SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) - 
  SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) as difference
FROM finance_ledger_entries;
-- Difference should be 0

-- Check for orphaned records
SELECT 'Orphaned ledger entries' as issue, COUNT(*) as count
FROM finance_ledger_entries le
LEFT JOIN finance_journal_entries je ON je.id = le.journal_entry_id
WHERE je.id IS NULL

UNION ALL

SELECT 'Orphaned invoice line items', COUNT(*)
FROM finance_invoice_line_items ili
LEFT JOIN finance_invoices i ON i.id = ili.invoice_id
WHERE i.id IS NULL;
```

### Database Maintenance

**Vacuum and Analyze:**

```sql
-- Run weekly during low-traffic hours
VACUUM ANALYZE finance_transactions;
VACUUM ANALYZE finance_journal_entries;
VACUUM ANALYZE finance_ledger_entries;
VACUUM ANALYZE finance_invoices;
```

**Reindex:**

```sql
-- Run monthly
REINDEX TABLE finance_transactions;
REINDEX TABLE finance_journal_entries;
REINDEX TABLE finance_ledger_entries;
```

---

## Configuration Files

### Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key

# Finance Module
FINANCE_RATE_LIMIT_MAX_REQUESTS=100
FINANCE_RATE_LIMIT_WINDOW_MS=60000
FINANCE_BACKUP_RETENTION_DAYS=30
FINANCE_BACKUP_RETENTION_MONTHS=84
```

### Feature Flags

```typescript
const FINANCE_FEATURES = {
  AI_RECEIPT_EXTRACTION: true,
  MULTI_CURRENCY: false, // Coming soon
  ADVANCED_FORECASTING: true,
  FRAUD_DETECTION: true,
  AUTOMATED_RECONCILIATION: false // Coming soon
};
```

---

## Support and Resources

### Internal Resources

- [API Documentation](./FINANCE_API_DOCUMENTATION.md)
- [User Guide](./FINANCE_USER_GUIDE.md)
- [Disaster Recovery](./FINANCE_DISASTER_RECOVERY.md)

### External Resources

- Supabase Documentation: https://supabase.com/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs/

### Getting Help

**Technical Support:**
- Email: tech-support@lazeez.com
- Slack: #finance-module-support

**Emergency Contact:**
- On-call: [Phone Number]
- Escalation: [Manager Contact]

---

*Last Updated: April 30, 2026*
*Version: 1.0*
