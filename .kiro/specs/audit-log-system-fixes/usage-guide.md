# Usage Guide: Enhanced Audit Logs & Currency Management

## For Administrators

### Setting the Default Currency

1. Navigate to **Finance** → **Settings** tab
2. Search for your desired currency in the search box
3. Click on the currency card to set it as default
4. A checkmark (✓) will appear next to the default currency
5. All financial displays will automatically update to use the new currency

**Note**: Only administrators can change the default currency.

### Viewing Audit Logs

1. Navigate to **Audit Logs** from the main menu
2. View all system-wide changes with user profiles:
   - User avatar and name
   - User role badge (Admin, Staff, Manager, Employee)
   - Action description
   - Entity type and action badges
   - Timestamp

3. Filter logs by:
   - Search query (entity name, type)
   - Entity type (Vendors, MOUs, Issues, Payments, etc.)
   - User (select from dropdown)
   - Action type (Created, Updated, Deleted)

4. Reset all filters with the filter button
5. Refresh logs with the refresh button

### Viewing Finance Audit Logs

1. Navigate to **Finance** → **Audit logs** tab
2. View finance-specific changes:
   - Accounts, Journal Entries, Vendor Finance
   - Commission Rules, Payments, Invoices
   - Revenue, Expenses, Subscriptions
   - Payouts (including Rider and Delivery payouts)

3. Filter by:
   - Entity type (dropdown with all finance entities)
   - Entity ID (search)
   - Date range (start and end dates)

4. Click on any row to expand and see detailed changes:
   - Field-by-field comparison
   - Old value → New value
   - Color-coded changes (red for old, green for new)

5. Export logs to CSV with the "Export to CSV" button

## For Managers

### Viewing Audit Logs

1. Navigate to **Audit Logs** from the main menu
2. You will see logs for:
   - Your own actions
   - Actions by employees in your department(s)

3. Use filters to narrow down results:
   - Filter by specific employee
   - Filter by entity type
   - Filter by action type

**Note**: Managers cannot see system-wide logs, only their department's logs.

## For All Users

### Understanding Audit Log Display

#### User Profile Section
- **Avatar**: User's profile picture or initials
- **Name**: Full name of the user who made the change
- **Role Badge**: Color-coded role indicator
  - Red: Admin
  - Blue: Staff/HR
  - Yellow: Manager
  - Green: Employee
- **Email**: User's email address

#### Action Description
Clear, human-readable description of what changed:
- "Created Vendor: 'Acme Corp'"
- "Vendor 'Acme Corp' status: active → inactive"
- "Updated MOU: 'Service Agreement'"
- "Deleted Issue: 'Bug Report'"

#### Entity Badges
- **Entity Type**: Shows what type of record changed (Vendor, MOU, Issue, etc.)
- **Action Type**: Shows the action performed (created, updated, deleted)
  - Green: Created
  - Blue: Updated
  - Red: Deleted
  - Yellow: Status Changed

#### Timeline View
- Logs are grouped by date
- Chronological order (newest first)
- Relative timestamps ("2 hours ago")
- Exact time stamps (3:45 PM)

### Understanding Currency Display

All financial amounts are displayed in the default currency:
- Format: `$1,234.56` (symbol + formatted amount)
- Consistent across all modules
- Automatic formatting with commas
- Two decimal places for precision

## For Developers

### Using CurrencyDisplay Component

```tsx
import { CurrencyDisplay } from "@/components/finance";

// Basic usage (uses default currency)
<CurrencyDisplay amount={1234.56} />
// Output: $1,234.56

// With currency code
<CurrencyDisplay amount={1234.56} showCode />
// Output: $1,234.56 USD

// Without symbol
<CurrencyDisplay amount={1234.56} showSymbol={false} />
// Output: 1,234.56

// Custom precision
<CurrencyDisplay amount={1234.567} precision={3} />
// Output: $1,234.567

// Use user's preferred currency
<CurrencyDisplay amount={1234.56} useUserPreference />
```

### Using CurrencyInput Component

```tsx
import { CurrencyInput } from "@/components/finance";

const [amount, setAmount] = useState(0);

<CurrencyInput
  value={amount}
  onChange={setAmount}
  placeholder="0.00"
/>
```

### Querying Audit Logs with Profiles

```tsx
import { useAuditLogs } from "@/hooks/useMainAuditLogs";

const { data: logs, isLoading } = useAuditLogs({
  limit: 100,
  entityType: "vendor",
  userId: "user-id-here",
});

// Access user profile
logs?.forEach(log => {
  console.log(log.user_profile?.full_name);
  console.log(log.user_profile?.avatar_url);
  console.log(log.user_profile?.main_role);
});
```

### Using Currency Hooks

```tsx
import {
  useCurrencies,
  useDefaultCurrency,
  useSetDefaultCurrency,
} from "@/components/hooks/useCurrency";

// Get all currencies
const { data: currencies } = useCurrencies();

// Get default currency
const { data: defaultCurrency } = useDefaultCurrency();

// Set default currency (admin only)
const setDefault = useSetDefaultCurrency();
await setDefault.mutateAsync("EUR");
```

## Troubleshooting

### Audit Logs Not Showing
- **Check permissions**: Ensure you have Admin or Manager role
- **Check filters**: Reset filters to see all logs
- **Refresh**: Click the refresh button to reload logs

### Currency Not Updating
- **Check admin access**: Only admins can change default currency
- **Clear cache**: Refresh the page to clear cached currency data
- **Check migration**: Ensure database migration has been run

### User Profiles Not Displaying
- **Check database**: Ensure profiles table has user data
- **Check migration**: Verify audit_logs table has user_id foreign key
- **Check RLS**: Ensure Row Level Security policies are correct

### Performance Issues
- **Reduce page size**: Use pagination with smaller page sizes
- **Apply filters**: Filter logs to reduce data volume
- **Check indexes**: Ensure database indexes are created

## Best Practices

### For Administrators
1. Set the default currency during initial setup
2. Review audit logs regularly for security
3. Export logs periodically for compliance
4. Monitor user activity for anomalies

### For Managers
1. Review your department's logs weekly
2. Use filters to focus on specific entities
3. Investigate unexpected changes promptly
4. Train team members on proper procedures

### For Developers
1. Always use CurrencyDisplay for amounts
2. Include user context in audit logs
3. Test currency conversion accuracy
4. Handle loading states properly
5. Implement error boundaries

## Support

For issues or questions:
1. Check this usage guide
2. Review the design document
3. Check the implementation summary
4. Contact system administrator
