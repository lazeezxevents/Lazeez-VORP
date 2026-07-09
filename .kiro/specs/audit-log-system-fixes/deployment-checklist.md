# Deployment Checklist: Audit Logs & Currency System

## Pre-Deployment Verification

### 1. Database Migration
- [ ] Review migration file: `supabase/migrations/20260318_currency_system.sql`
- [ ] Verify SQL syntax is correct
- [ ] Check for naming conflicts with existing tables
- [ ] Ensure RLS policies are properly defined
- [ ] Verify foreign key constraints are correct

### 2. Code Review
- [ ] All TypeScript files compile without errors
- [ ] No console errors in development
- [ ] All imports are correct
- [ ] No unused variables or imports
- [ ] Proper error handling in all async functions
- [ ] Loading states implemented everywhere
- [ ] Empty states implemented everywhere

### 3. Component Testing
- [ ] CurrencySelector renders correctly
- [ ] CurrencyDisplay formats amounts properly
- [ ] CurrencyInput accepts numeric input only
- [ ] AuditLogs displays user profiles
- [ ] AuditLogViewer shows finance logs
- [ ] Avatar fallbacks work correctly
- [ ] Role badges display correct colors

### 4. Functionality Testing
- [ ] Admin can set default currency
- [ ] Non-admin cannot access currency settings
- [ ] Currency changes persist after refresh
- [ ] Audit logs show user avatars and names
- [ ] Finance audit logs filter correctly
- [ ] Manager sees only department logs
- [ ] Employee cannot access audit logs
- [ ] CSV export includes user information

### 5. Security Testing
- [ ] RLS policies prevent unauthorized access
- [ ] Admin-only functions reject non-admin users
- [ ] Manager filtering works correctly
- [ ] User preferences are user-specific
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

### 6. Performance Testing
- [ ] Audit log queries complete in < 500ms
- [ ] Currency queries are cached properly
- [ ] Profile joins don't cause N+1 queries
- [ ] Pagination works correctly
- [ ] Large datasets don't cause UI lag
- [ ] Animations are smooth (60fps)

## Deployment Steps

### Step 1: Backup Database
```bash
# Create backup before migration
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Run Migration
```bash
# Apply migration to development first
supabase db push

# Verify migration succeeded
supabase db diff
```

### Step 3: Verify Database
```sql
-- Check tables exist
SELECT * FROM system_currencies LIMIT 5;
SELECT * FROM user_currency_preferences LIMIT 5;

-- Check default currency is set
SELECT * FROM system_currencies WHERE is_default = true;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('system_currencies', 'user_currency_preferences');

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%currency%';
```

### Step 4: Deploy Frontend
```bash
# Build production bundle
npm run build

# Test production build locally
npm run preview

# Deploy to hosting (adjust for your platform)
# Example for Vercel:
vercel deploy --prod
```

### Step 5: Smoke Testing
- [ ] Login as admin
- [ ] Navigate to Finance → Settings
- [ ] Change default currency
- [ ] Verify currency displays update
- [ ] Navigate to Audit Logs
- [ ] Verify user profiles display
- [ ] Test filters and search
- [ ] Export audit logs to CSV
- [ ] Login as manager
- [ ] Verify restricted access to logs
- [ ] Login as employee
- [ ] Verify no access to audit logs

### Step 6: Monitor
- [ ] Check application logs for errors
- [ ] Monitor database query performance
- [ ] Check for failed API calls
- [ ] Monitor user feedback
- [ ] Check browser console for errors

## Post-Deployment Verification

### 1. Functional Verification
- [ ] All users can view financial amounts in default currency
- [ ] Admins can change default currency
- [ ] Audit logs display user information correctly
- [ ] Finance audit logs filter properly
- [ ] CSV export works correctly
- [ ] Animations are smooth
- [ ] Loading states display properly

### 2. Data Verification
```sql
-- Verify currency data
SELECT code, name, is_default, is_active FROM system_currencies;

-- Check audit logs have user profiles
SELECT 
  al.id,
  al.entity_type,
  al.action,
  p.full_name,
  p.email
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
LIMIT 10;

-- Verify no orphaned records
SELECT COUNT(*) FROM audit_logs WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM profiles);
```

### 3. Performance Verification
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT al.*, p.full_name, p.email, p.avatar_url, p.main_role
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 100;

-- Should use indexes and complete in < 100ms
```

### 4. Security Verification
- [ ] Test RLS policies with different user roles
- [ ] Verify admin-only functions reject non-admins
- [ ] Check manager filtering works correctly
- [ ] Verify user preferences are isolated
- [ ] Test for SQL injection attempts
- [ ] Test for XSS attempts

## Rollback Plan

### If Issues Occur

#### Option 1: Rollback Migration
```bash
# Restore from backup
psql -d your_database < backup_YYYYMMDD_HHMMSS.sql

# Or use Supabase rollback
supabase db reset
```

#### Option 2: Disable Features
```typescript
// In GeneralLedgerPage.tsx, comment out settings tab
// {isAdmin && (
//   <TabsTrigger value="settings" className="gap-2">
//     <Settings className="w-4 h-4" />
//     Settings
//   </TabsTrigger>
// )}

// In AuditLogs.tsx, use old query without profiles
// Revert to previous version of useAuditLogs
```

#### Option 3: Hotfix
- Identify specific issue
- Create hotfix branch
- Fix issue
- Test thoroughly
- Deploy hotfix

## Known Issues & Workarounds

### Issue 1: Avatar Images Not Loading
**Symptom**: User avatars show fallback initials even when avatar_url exists
**Workaround**: Check CORS settings on storage bucket
**Fix**: Update storage bucket CORS policy

### Issue 2: Currency Not Updating
**Symptom**: Currency changes don't reflect immediately
**Workaround**: Hard refresh browser (Ctrl+Shift+R)
**Fix**: Invalidate React Query cache on currency change

### Issue 3: Slow Audit Log Queries
**Symptom**: Audit logs take > 1 second to load
**Workaround**: Reduce page size to 50
**Fix**: Add composite index on (created_at, user_id)

## Support Contacts

- **Database Issues**: DBA Team
- **Frontend Issues**: Frontend Team
- **Security Issues**: Security Team
- **Performance Issues**: DevOps Team

## Documentation Links

- [Design Document](.kiro/specs/audit-log-system-fixes/design.md)
- [Implementation Summary](.kiro/specs/audit-log-system-fixes/implementation.md)
- [Usage Guide](.kiro/specs/audit-log-system-fixes/usage-guide.md)
- [Bugfix Requirements](.kiro/specs/audit-log-system-fixes/bugfix.md)

## Success Criteria

Deployment is successful when:
- ✅ All 16 currencies are seeded and active (including PKR)
- ✅ PKR is set as default currency
- ✅ Admins can change default currency
- ✅ All financial amounts display in default currency
- ✅ Audit logs show user avatars and names
- ✅ Finance audit logs include all entity types
- ✅ Manager access restrictions work correctly
- ✅ CSV export includes user information
- ✅ No console errors
- ✅ No database errors
- ✅ Performance is acceptable (< 500ms queries)
- ✅ All animations are smooth
- ✅ Mobile responsive (if applicable)

## Sign-Off

- [ ] Development Team Lead: _________________ Date: _______
- [ ] QA Team Lead: _________________ Date: _______
- [ ] Security Team: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______
- [ ] DevOps Team: _________________ Date: _______

## Notes

Add any deployment-specific notes here:
- 
- 
- 
