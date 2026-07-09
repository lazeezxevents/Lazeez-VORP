# Audit Log System Enhancement & Currency Management Design

## Executive Summary

This design document outlines enhancements to the unified audit log system and the implementation of a global currency management system for the Finance module. The audit log system will be enhanced to display user avatars, names, and include finance-specific logs with proper filtering. The currency system will allow administrators to select and set a default currency that applies across all financial operations.

## System Architecture

### 1. Enhanced Audit Log Display

#### 1.1 User Profile Integration
The audit log system will be enhanced to display rich user information:
- User avatar (profile picture)
- Full name
- Email address
- User role badge

#### 1.2 Finance Log Integration
Finance-specific audit logs will be properly integrated:
- All finance entity types included (account, journal_entry, vendor_financial_profile, commission_rule, payment, invoice, revenue, expense, subscription, payout, rider_payout, delivery_payout)
- Proper filtering between main system logs and finance logs
- Unified display with consistent styling

### 2. Global Currency Management System

#### 2.1 Currency Configuration Table
A new `system_currencies` table will store:
- Currency code (USD, EUR, GBP, etc.)
- Currency symbol ($, €, £, etc.)
- Currency name
- Exchange rate (relative to base currency)
- Is default flag
- Active status

#### 2.2 User Currency Preferences
A new `user_currency_preferences` table will store:
- User ID
- Preferred currency
- Last updated timestamp

#### 2.3 Default Currency Selection
- Admin-only interface to select default currency
- Visual indicator (checkmark) for default currency
- All financial displays automatically use default currency
- Real-time currency conversion for multi-currency support

## Component Architecture

### 1. Enhanced Audit Log Components

#### Main Audit Logs Page (`AuditLogs.tsx`)
```typescript
interface EnhancedAuditLog extends AuditLog {
  user_profile?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    main_role: string;
  };
}
```

Features:
- User avatar display with fallback initials
- Full name with role badge
- Finance log inclusion
- Reset filters button
- Manager access control

#### Finance Audit Log Viewer (`AuditLogViewer.tsx`)
Features:
- Finance-only entity filtering
- User profile display
- Expandable row details
- CSV export with user information

### 2. Currency Management Components

#### Currency Selector Component (`CurrencySelector.tsx`)
```typescript
interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  showDefault?: boolean;
  adminOnly?: boolean;
}
```

Features:
- Dropdown with currency list
- Visual indicator for default currency
- Search/filter currencies
- Admin-only default setting

#### Currency Display Component (`CurrencyDisplay.tsx`)
```typescript
interface CurrencyDisplayProps {
  amount: number;
  currency?: string; // Uses default if not specified
  showSymbol?: boolean;
  precision?: number;
}
```

Features:
- Automatic formatting
- Symbol display
- Locale-aware formatting
- Conversion support

## Database Schema

### 1. Enhanced Audit Logs Query

```sql
-- Join with profiles to get user information
SELECT 
  al.*,
  p.full_name,
  p.email,
  p.avatar_url,
  p.main_role
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
WHERE ...
```

### 2. System Currencies Table

```sql
CREATE TABLE system_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(3) UNIQUE NOT NULL, -- ISO 4217
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  exchange_rate DECIMAL(15, 6) DEFAULT 1.0,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one default currency
CREATE UNIQUE INDEX idx_system_currencies_default 
  ON system_currencies(is_default) 
  WHERE is_default = TRUE;
```

### 3. User Currency Preferences Table

```sql
CREATE TABLE user_currency_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL REFERENCES system_currencies(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Data Flow

### 1. Audit Log Display Flow

```
User Opens Audit Logs
  ↓
Query audit_logs with profile join
  ↓
Fetch user avatars and names
  ↓
Apply role-based filtering (admin/manager)
  ↓
Display with user profile cards
  ↓
Group by date with timeline view
```

### 2. Currency Selection Flow

```
Admin Opens Currency Settings
  ↓
Display available currencies
  ↓
Admin selects currency and marks as default
  ↓
Update system_currencies table
  ↓
Broadcast currency change event
  ↓
All financial displays refresh with new currency
```

### 3. Currency Display Flow

```
Component needs to display amount
  ↓
Check for explicit currency prop
  ↓
If not provided, fetch default currency
  ↓
Format amount with currency symbol
  ↓
Apply locale-specific formatting
  ↓
Display formatted value
```

## API Endpoints

### 1. Audit Log Service Enhancements

```typescript
// Enhanced query with user profiles
export async function queryAuditLogsWithProfiles(
  filter: AuditLogFilter,
  limit: number,
  offset: number,
  financeOnly: boolean
): Promise<{ data: EnhancedAuditLog[]; count: number }>;

// Get user profile for audit log
export async function getUserProfile(userId: string): Promise<UserProfile>;
```

### 2. Currency Service

```typescript
// Get all active currencies
export async function getCurrencies(): Promise<Currency[]>;

// Get default currency
export async function getDefaultCurrency(): Promise<Currency>;

// Set default currency (admin only)
export async function setDefaultCurrency(code: string): Promise<void>;

// Get user currency preference
export async function getUserCurrency(userId: string): Promise<string>;

// Set user currency preference
export async function setUserCurrency(userId: string, code: string): Promise<void>;

// Format amount with currency
export function formatCurrency(amount: number, currency?: string): string;

// Convert between currencies
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number>;
```

## UI/UX Design

### 1. Audit Log User Display

```
┌─────────────────────────────────────────────────────────┐
│ [Avatar] John Doe (Admin)                               │
│          john.doe@company.com                           │
│          Created Vendor: "Acme Corp"                    │
│          2 hours ago                                    │
└─────────────────────────────────────────────────────────┘
```

Features:
- Circular avatar with fallback initials
- Name with role badge
- Email in muted text
- Action description
- Relative timestamp

### 2. Currency Selector UI

```
┌─────────────────────────────────────────────────────────┐
│ Default Currency                                        │
│ ┌─────────────────────────────────────────────────┐   │
│ │ USD - United States Dollar ($)          [✓]     │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Other Currencies                                        │
│ ┌─────────────────────────────────────────────────┐   │
│ │ EUR - Euro (€)                          [ ]     │   │
│ │ GBP - British Pound (£)                 [ ]     │   │
│ │ JPY - Japanese Yen (¥)                  [ ]     │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Features:
- Visual checkmark for default
- Currency code, name, and symbol
- Radio button selection
- Search/filter capability

### 3. Currency Display in Finance Module

All financial amounts will display with currency:
- `$1,234.56` (with symbol)
- `1,234.56 USD` (with code)
- Consistent formatting across all components

## Security Considerations

### 1. Audit Log Access Control
- Admin: Full access to all logs
- Manager: Access to logs for their department only
- Employee: No access to audit logs
- RLS policies enforce access control

### 2. Currency Management Access
- Only admins can set default currency
- All users can view available currencies
- User preferences are user-specific
- Currency changes are audit logged

## Performance Optimization

### 1. Audit Log Performance
- Index on user_id for fast profile joins
- Pagination with 50-100 records per page
- Caching of user profiles
- Lazy loading of avatars

### 2. Currency Performance
- Cache default currency in memory
- Cache exchange rates (refresh hourly)
- Preload currency list on app init
- Memoize currency formatting functions

## Migration Strategy

### Phase 1: Database Setup
1. Create system_currencies table
2. Create user_currency_preferences table
3. Seed default currencies (PKR, USD, EUR, GBP, etc.)
4. Set PKR as default

### Phase 2: Backend Implementation
1. Implement currency service functions
2. Add currency hooks
3. Update audit log queries with profile joins
4. Add currency audit logging

### Phase 3: Frontend Implementation
1. Create CurrencySelector component
2. Create CurrencyDisplay component
3. Update audit log components with user profiles
4. Add currency settings to admin panel
5. Update all financial displays to use currency

### Phase 4: Testing & Rollout
1. Test currency conversion accuracy
2. Test audit log performance with large datasets
3. Test role-based access control
4. Deploy to production

## Testing Requirements

### 1. Audit Log Testing
- Verify user profiles display correctly
- Test manager access restrictions
- Verify finance log filtering
- Test pagination and performance
- Verify avatar fallbacks

### 2. Currency Testing
- Test default currency selection
- Verify currency formatting
- Test currency conversion accuracy
- Verify admin-only access
- Test multi-currency displays

## Monitoring & Observability

### 1. Audit Log Metrics
- Query performance (< 500ms)
- Profile join performance
- Cache hit rates
- Access control violations

### 2. Currency Metrics
- Currency change frequency
- Conversion API calls
- Exchange rate update success
- User preference changes

## Future Enhancements

### 1. Audit Log Enhancements
- Advanced filtering (date ranges, multiple users)
- Export with user profiles
- Real-time log streaming
- Log retention policies

### 2. Currency Enhancements
- Automatic exchange rate updates
- Multi-currency transaction support
- Currency conversion history
- Custom exchange rate overrides
- Currency-specific rounding rules

## Conclusion

This design provides a comprehensive enhancement to the audit log system with rich user profile display and a robust global currency management system. The implementation follows production-grade practices with proper security, performance optimization, and scalability considerations.
