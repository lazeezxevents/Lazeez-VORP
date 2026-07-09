# Exchange Rate API Integration

## Overview

The Exchange Rate API integration provides comprehensive multi-currency support for the Finance Module with automatic daily rate updates, multiple provider fallback, and professional UI components.

## Features

### 1. Exchange Rate Service (`ExchangeRateService.ts`)

**Core Functionality:**
- Fetch exchange rates from multiple external APIs with automatic fallback
- Store historical exchange rates in the database
- Retrieve rates for specific dates or latest available
- Validate exchange rates for reasonableness
- Support for PKR as base currency

**API Providers (with fallback order):**
1. **ExchangeRate-API** (Primary)
   - Free tier: 1,500 requests/month
   - No API key required
   - URL: `https://api.exchangerate-api.com/v4/latest/{base}`

2. **Frankfurter API** (Fallback)
   - Free, unlimited requests
   - No API key required
   - URL: `https://api.frankfurter.app/latest?from={base}`

3. **Fixer.io** (Optional fallback)
   - Requires API key (set `VITE_FIXER_API_KEY`)
   - URL: `https://api.fixer.io/latest?access_key={key}&base={base}`

**Key Functions:**

```typescript
// Fetch rates with automatic fallback
const { rates, source, error } = await fetchExchangeRatesWithFallback("PKR");

// Store rates in database (includes inverse rates)
await storeExchangeRates("PKR", rates, source);

// Get rate for specific date
const { data: rate } = await getExchangeRate("PKR", "USD", new Date());

// Get latest available rate
const { data: latestRate } = await getLatestExchangeRate("PKR", "USD");

// Get historical rates
const { data: history } = await getHistoricalRates(
  "PKR", 
  "USD", 
  startDate, 
  endDate
);

// Update daily rates (manual trigger)
const result = await updateDailyExchangeRates("PKR");

// Validate rate
const { valid, reason } = validateExchangeRate(278.5, "PKR", "USD");
```

### 2. Supabase Edge Function (`fetch-exchange-rates`)

**Purpose:** Automatic daily exchange rate updates via cron job

**Location:** `supabase/functions/fetch-exchange-rates/index.ts`

**Features:**
- Runs on schedule (configure in Supabase dashboard)
- Fetches rates from multiple providers with fallback
- Stores both direct and inverse rates
- Returns detailed success/error information

**Setup:**

1. Deploy the edge function:
```bash
supabase functions deploy fetch-exchange-rates
```

2. Set up cron job in Supabase dashboard:
   - Go to Database → Cron Jobs
   - Create new job: `fetch-exchange-rates-daily`
   - Schedule: `0 0 * * *` (daily at midnight UTC)
   - Command: `SELECT net.http_post(...)`

3. Or invoke manually:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-exchange-rates \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. UI Components

#### CurrencySelectorDialog

Professional currency selector with micro-interactions:

```tsx
import { CurrencySelectorDialog } from "@/components/finance";

<CurrencySelectorDialog
  open={open}
  onOpenChange={setOpen}
  onSelect={(currency) => console.log(currency)}
  currentCurrency={currentCurrency}
  baseCurrency="PKR"
/>
```

**Features:**
- Search by code, name, or symbol
- Real-time exchange rate display
- Trend indicators (up/down/stable)
- Framer Motion animations
- Staggered entry animations
- Hover effects and micro-interactions
- Loading states with skeletons
- Empty state handling

#### CurrencySelectorButton

Compact currency selector button with refresh capability:

```tsx
import { CurrencySelectorButton } from "@/components/finance";

<CurrencySelectorButton
  onCurrencyChange={(currency) => console.log(currency)}
  showRefresh={true}
  variant="outline"
  size="default"
/>
```

**Features:**
- Shows current currency with symbol and code
- Animated chevron on open/close
- Optional refresh button with rotation animation
- Saves user preference automatically
- Loads user preference or default currency

### 4. React Hooks

#### useExchangeRates

Manage exchange rate updates:

```tsx
import { useExchangeRates } from "@/components/finance";

const { updateRates, isUpdating } = useExchangeRates();

// Trigger manual update
updateRates("PKR");
```

#### useExchangeRate

Fetch specific exchange rate:

```tsx
import { useExchangeRate } from "@/components/finance";

const { data: rate, isLoading } = useExchangeRate("PKR", "USD", new Date());
```

#### useLatestExchangeRate

Fetch latest available rate:

```tsx
import { useLatestExchangeRate } from "@/components/finance";

const { data: rate, isLoading } = useLatestExchangeRate("PKR", "USD");
```

#### useHistoricalRates

Fetch historical rates for a date range:

```tsx
import { useHistoricalRates } from "@/components/finance";

const { data: rates, isLoading } = useHistoricalRates(
  "PKR",
  "USD",
  startDate,
  endDate
);
```

#### useCurrencyConverter

Complete currency converter with state management:

```tsx
import { useCurrencyConverter } from "@/components/finance";

const {
  amount,
  setAmount,
  fromCurrency,
  setFromCurrency,
  toCurrency,
  setToCurrency,
  convertedAmount,
  rate,
  isLoading,
} = useCurrencyConverter();
```

## Database Schema

The exchange rates are stored in the `finance_exchange_rates` table:

```sql
CREATE TABLE finance_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 6) NOT NULL,
  rate_date DATE NOT NULL,
  source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);
```

**Key Features:**
- Unique constraint on (from_currency, to_currency, rate_date)
- Stores both direct and inverse rates
- Tracks source provider for each rate
- Historical tracking with rate_date

## Design System Compliance

All UI components follow the Lazeez VORP design system:

✅ **Typography:**
- Sentence case for UI text
- Title case for headings
- No ALL CAPS

✅ **Animations:**
- Framer Motion for all animations
- Staggered entry patterns
- Hover scale effects (1.02)
- Tap scale effects (0.98)
- Icon rotation animations

✅ **Colors:**
- Semantic color variables
- Success/warning/error states
- Muted foreground for secondary text

✅ **Interactions:**
- Immediate feedback on clicks
- Loading states with skeletons
- Toast notifications for success/error
- Keyboard accessible

✅ **Accessibility:**
- WCAG AA compliant
- Semantic HTML
- Proper ARIA labels
- Keyboard navigation support

## Testing

Comprehensive test suite in `__tests__/exchangeRates.test.ts`:

```bash
npm run test -- exchangeRates.test.ts
```

**Test Coverage:**
- Rate validation (positive, negative, bounds)
- Provider fallback mechanism
- Database operations (store, retrieve)
- Rate conversion consistency
- Historical rate queries
- Error handling

## Usage Examples

### Basic Currency Conversion

```tsx
import { CurrencySelectorButton } from "@/components/finance";

function MyComponent() {
  return (
    <div>
      <CurrencySelectorButton
        onCurrencyChange={(currency) => {
          console.log("Selected:", currency);
        }}
      />
    </div>
  );
}
```

### Manual Rate Update

```tsx
import { useExchangeRates } from "@/components/finance";
import { Button } from "@/components/ui/button";

function UpdateRatesButton() {
  const { updateRates, isUpdating } = useExchangeRates();

  return (
    <Button onClick={() => updateRates()} disabled={isUpdating}>
      {isUpdating ? "Updating..." : "Update Rates"}
    </Button>
  );
}
```

### Display Exchange Rate

```tsx
import { useLatestExchangeRate } from "@/components/finance";

function ExchangeRateDisplay() {
  const { data: rate, isLoading } = useLatestExchangeRate("PKR", "USD");

  if (isLoading) return <div>Loading...</div>;
  if (!rate) return <div>No rate available</div>;

  return (
    <div>
      1 PKR = {rate.rate.toFixed(6)} USD
      <br />
      Source: {rate.source}
      <br />
      Date: {new Date(rate.rate_date).toLocaleDateString()}
    </div>
  );
}
```

## Configuration

### Environment Variables

Optional API keys for additional providers:

```env
# Optional: Fixer.io API key for fallback
VITE_FIXER_API_KEY=your_fixer_api_key
```

### Cron Job Setup

To enable automatic daily updates:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new job with schedule: `0 0 * * *` (daily at midnight)
3. Or use pg_cron directly:

```sql
SELECT cron.schedule(
  'fetch-exchange-rates-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/fetch-exchange-rates',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## Error Handling

The service implements comprehensive error handling:

1. **Provider Fallback:** If one API fails, automatically tries the next
2. **Database Errors:** Gracefully handled with error messages
3. **Validation:** Rates are validated for reasonableness before storage
4. **User Feedback:** Toast notifications for all operations
5. **Logging:** Console logs for debugging

## Performance Considerations

- **Caching:** React Query caches rates for 1 hour
- **Stale Time:** Historical rates cached for 24 hours
- **Debouncing:** Search inputs debounced at 300ms
- **Lazy Loading:** Components load data only when needed
- **Optimistic Updates:** UI updates immediately, syncs in background

## Maintenance

### Monitoring

Check exchange rate updates:

```sql
-- Get latest rates
SELECT * FROM finance_exchange_rates
WHERE rate_date = CURRENT_DATE
ORDER BY from_currency, to_currency;

-- Check rate sources
SELECT source, COUNT(*) as count
FROM finance_exchange_rates
WHERE rate_date = CURRENT_DATE
GROUP BY source;

-- Find missing rates
SELECT DISTINCT from_currency, to_currency
FROM finance_exchange_rates
WHERE rate_date = CURRENT_DATE - INTERVAL '1 day'
  AND NOT EXISTS (
    SELECT 1 FROM finance_exchange_rates e2
    WHERE e2.from_currency = finance_exchange_rates.from_currency
      AND e2.to_currency = finance_exchange_rates.to_currency
      AND e2.rate_date = CURRENT_DATE
  );
```

### Troubleshooting

**Rates not updating:**
1. Check cron job is running
2. Verify edge function is deployed
3. Check API provider status
4. Review edge function logs

**Invalid rates:**
1. Check validation logic
2. Review provider responses
3. Verify database constraints

**UI not showing rates:**
1. Check React Query cache
2. Verify database connection
3. Review browser console for errors

## Future Enhancements

- [ ] Add more currency providers
- [ ] Implement rate change alerts
- [ ] Add currency conversion history
- [ ] Support custom exchange rates
- [ ] Add rate comparison charts
- [ ] Implement rate forecasting
- [ ] Add bulk rate import/export
- [ ] Support cryptocurrency rates

## Requirements Satisfied

✅ **Requirement 17.4:** Fetch exchange rates from external API daily
✅ **Requirement 17.5:** Store rates in finance_exchange_rates table
✅ **Design:** Implement fallback to multiple providers for reliability
✅ **Design:** PKR as base currency for all transactions
✅ **Design:** Professional UI with micro-interactions
✅ **Design:** Follow design system guidelines

## Related Documentation

- [Currency System Migration](../../../supabase/migrations/20260318_currency_system.sql)
- [Finance Module Design](../../../.kiro/specs/finance-module/design.md)
- [Finance Module Requirements](../../../.kiro/specs/finance-module/requirements.md)
