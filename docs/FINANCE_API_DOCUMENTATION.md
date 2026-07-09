# Finance Module API Documentation

## Overview

The Finance Module provides comprehensive financial management capabilities including accounting, revenue tracking, invoicing, expense management, and financial reporting. This document details all service classes, methods, and their usage.

## Table of Contents

1. [General Ledger](#general-ledger)
2. [Revenue Management](#revenue-management)
3. [Commission Engine](#commission-engine)
4. [Subscription Management](#subscription-management)
5. [Accounts Receivable](#accounts-receivable)
6. [Accounts Payable](#accounts-payable)
7. [Expense Management](#expense-management)
8. [Receipt Vault](#receipt-vault)
9. [Financial Reporting](#financial-reporting)
10. [Budget Management](#budget-management)
11. [Forecasting](#forecasting)
12. [Tax Management](#tax-management)
13. [Fraud Prevention](#fraud-prevention)
14. [Security Services](#security-services)

---

## General Ledger

### GeneralLedger Service

Core accounting service for managing journal entries and ledger operations.

#### Methods

##### `createJournalEntry(entry: JournalEntryInput): Promise<JournalEntry>`

Creates a new journal entry with automatic balance validation.

**Parameters:**
```typescript
interface JournalEntryInput {
  date: Date;
  description: string;
  reference?: string;
  lineItems: LineItem[];
}

interface LineItem {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}
```

**Returns:** Created journal entry with ID

**Example:**
```typescript
import { GeneralLedger } from '@/components/finance/GeneralLedger';

const gl = GeneralLedger.getInstance();

const entry = await gl.createJournalEntry({
  date: new Date(),
  description: 'Customer payment received',
  lineItems: [
    { accountId: 'cash-account', debit: 1000, credit: 0 },
    { accountId: 'revenue-account', debit: 0, credit: 1000 }
  ]
});
```

**Throws:**
- `Error` if debits don't equal credits
- `Error` if account doesn't exist

---

##### `postTransaction(transaction: Transaction): Promise<void>`

Posts a transaction to the general ledger with atomic operations.

**Parameters:**
```typescript
interface Transaction {
  type: 'revenue' | 'expense' | 'transfer';
  amount: number;
  sourceModule: string;
  sourceId: string;
  description: string;
}
```

**Example:**
```typescript
await gl.postTransaction({
  type: 'revenue',
  amount: 500,
  sourceModule: 'orders',
  sourceId: 'order-123',
  description: 'Order payment'
});
```

---

##### `getAccountBalance(accountId: string): Promise<number>`

Retrieves current balance for an account.

**Returns:** Account balance (positive for debit accounts, negative for credit accounts)

**Example:**
```typescript
const balance = await gl.getAccountBalance('cash-account');
console.log(`Cash balance: ${balance}`);
```

---

##### `getTrialBalance(date?: Date): Promise<TrialBalance>`

Generates trial balance report for specified date.

**Returns:**
```typescript
interface TrialBalance {
  date: Date;
  accounts: Array<{
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
}
```

**Example:**
```typescript
const trialBalance = await gl.getTrialBalance(new Date());
console.log(`Balanced: ${trialBalance.balanced}`);
```

---

## Revenue Management

### RevenueManager Service

Handles revenue recording and commission calculation.

#### Methods

##### `recordRevenue(order: OrderData): Promise<void>`

Records revenue from completed orders.

**Parameters:**
```typescript
interface OrderData {
  orderId: string;
  vendorId: string;
  amount: number;
  commissionRate: number;
  completedAt: Date;
}
```

**Example:**
```typescript
import { RevenueManager } from '@/components/finance/RevenueManager';

const rm = RevenueManager.getInstance();

await rm.recordRevenue({
  orderId: 'order-456',
  vendorId: 'vendor-789',
  amount: 1500,
  commissionRate: 0.15,
  completedAt: new Date()
});
```

**Performance:** Completes within 100ms

---

##### `calculateCommission(order: OrderData): Promise<number>`

Calculates commission for an order.

**Returns:** Commission amount

**Example:**
```typescript
const commission = await rm.calculateCommission({
  orderId: 'order-456',
  vendorId: 'vendor-789',
  amount: 1500,
  commissionRate: 0.15,
  completedAt: new Date()
});
// Returns: 225
```

---

## Commission Engine

### CommissionEngine Service

Advanced commission calculation with multiple models.

#### Methods

##### `calculateVendorCommission(order: OrderData, profile: VendorProfile): Promise<number>`

Calculates vendor commission based on profile configuration.

**Supported Models:**
- Flat rate
- Percentage-based
- Tiered
- Category-based

**Example:**
```typescript
import { CommissionEngine } from '@/components/finance/CommissionEngine';

const engine = CommissionEngine.getInstance();

const commission = await engine.calculateVendorCommission(
  { orderId: 'order-123', amount: 2000 },
  { commissionModel: 'tiered', tiers: [...] }
);
```

---

## Subscription Management

### SubscriptionManager Service

Manages vendor subscriptions and threshold-based billing.

#### Methods

##### `createSubscription(vendorId: string, plan: SubscriptionPlan): Promise<Subscription>`

Creates a new subscription for a vendor.

**Parameters:**
```typescript
interface SubscriptionPlan {
  name: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  orderThreshold: number;
}
```

**Example:**
```typescript
import { SubscriptionManager } from '@/components/finance/SubscriptionManager';

const sm = SubscriptionManager.getInstance();

const subscription = await sm.createSubscription('vendor-123', {
  name: 'Premium Plan',
  price: 99.99,
  billingCycle: 'monthly',
  orderThreshold: 100
});
```

---

##### `checkThreshold(vendorId: string): Promise<boolean>`

Checks if vendor has reached billing threshold.

**Returns:** `true` if threshold reached

**Example:**
```typescript
const thresholdReached = await sm.checkThreshold('vendor-123');
if (thresholdReached) {
  await sm.generateInvoice('vendor-123');
}
```

---

## Accounts Receivable

### AccountsReceivable Service

Manages customer invoices and payments.

#### Methods

##### `createInvoice(invoice: InvoiceInput): Promise<Invoice>`

Creates a new customer invoice.

**Parameters:**
```typescript
interface InvoiceInput {
  customerId: string;
  lineItems: InvoiceLineItem[];
  dueDate: Date;
  terms?: string;
}
```

**Example:**
```typescript
import { AccountsReceivable } from '@/components/finance/AccountsReceivable';

const ar = AccountsReceivable.getInstance();

const invoice = await ar.createInvoice({
  customerId: 'customer-456',
  lineItems: [
    { description: 'Service', quantity: 1, unitPrice: 500 }
  ],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
});
```

---

##### `recordPayment(invoiceId: string, amount: number): Promise<void>`

Records a payment against an invoice.

**Example:**
```typescript
await ar.recordPayment('invoice-789', 500);
```

---

##### `getAgingReport(asOfDate: Date): Promise<AgingReport>`

Generates accounts receivable aging report.

**Returns:**
```typescript
interface AgingReport {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
  total: number;
}
```

---

## Expense Management

### ExpenseManager Service

Handles employee expense submissions and approvals.

#### Methods

##### `submitExpense(expense: ExpenseInput): Promise<Expense>`

Submits a new expense for approval.

**Parameters:**
```typescript
interface ExpenseInput {
  employeeId: string;
  category: string;
  amount: number;
  date: Date;
  description: string;
  receiptUrl?: string;
}
```

**Example:**
```typescript
import { ExpenseManager } from '@/components/finance/ExpenseManager';

const em = ExpenseManager.getInstance();

const expense = await em.submitExpense({
  employeeId: 'emp-123',
  category: 'travel',
  amount: 150,
  date: new Date(),
  description: 'Client meeting transportation'
});
```

---

##### `approveExpense(expenseId: string, approverId: string): Promise<void>`

Approves an expense.

**Example:**
```typescript
await em.approveExpense('expense-456', 'manager-789');
```

---

## Receipt Vault

### ReceiptVault Service

AI-powered receipt management and data extraction.

#### Methods

##### `uploadReceipt(file: File, category: string): Promise<Receipt>`

Uploads and processes a receipt with OCR and AI extraction.

**Parameters:**
- `file`: PDF, JPG, or PNG file
- `category`: 'riders' | 'vendors' | 'general'

**Example:**
```typescript
import { ReceiptVault } from '@/components/finance/ReceiptVault';

const rv = ReceiptVault.getInstance();

const receipt = await rv.uploadReceipt(file, 'vendors');
console.log(`Extracted amount: ${receipt.extractedData.amount}`);
console.log(`Confidence: ${receipt.confidence}%`);
```

---

##### `extractReceiptData(receiptId: string): Promise<ExtractedData>`

Extracts structured data from receipt using AI.

**Returns:**
```typescript
interface ExtractedData {
  merchant: string;
  date: Date;
  amount: number;
  tax: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  confidence: number;
}
```

---

## Financial Reporting

### ProfitLossManager Service

Generates P&L statements and financial reports.

#### Methods

##### `generatePL(startDate: Date, endDate: Date): Promise<PLStatement>`

Generates profit and loss statement for date range.

**Returns:**
```typescript
interface PLStatement {
  period: { start: Date; end: Date };
  revenue: {
    total: number;
    breakdown: Record<string, number>;
  };
  expenses: {
    cogs: number;
    operating: number;
    breakdown: Record<string, number>;
  };
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  margins: {
    gross: number;
    operating: number;
    net: number;
  };
}
```

**Example:**
```typescript
import { ProfitLossManager } from '@/components/finance/ProfitLossManager';

const plm = ProfitLossManager.getInstance();

const pl = await plm.generatePL(
  new Date('2026-01-01'),
  new Date('2026-12-31')
);

console.log(`Net Income: ${pl.netIncome}`);
console.log(`Net Margin: ${pl.margins.net}%`);
```

**Performance:** Generates within 2 seconds

---

### CashFlowManager Service

Tracks and forecasts cash flow.

#### Methods

##### `getCashFlowStatement(startDate: Date, endDate: Date): Promise<CashFlowStatement>`

Generates cash flow statement.

**Returns:**
```typescript
interface CashFlowStatement {
  period: { start: Date; end: Date };
  operating: {
    inflows: number;
    outflows: number;
    net: number;
  };
  investing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  financing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
}
```

---

##### `forecastCashFlow(months: number): Promise<CashFlowForecast[]>`

Forecasts future cash flow.

**Example:**
```typescript
const forecast = await cfm.forecastCashFlow(6);
forecast.forEach(month => {
  console.log(`${month.month}: ${month.projectedCash}`);
});
```

---

## Security Services

### RateLimiter

Rate limiting for financial operations.

#### Methods

##### `checkLimit(userId: string, endpoint: string): Promise<RateLimitResult>`

Checks if request is within rate limit.

**Returns:**
```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}
```

**Example:**
```typescript
import { RateLimiter } from '@/components/finance/RateLimiter';

const limiter = RateLimiter.getInstance();

const { allowed, remaining } = await limiter.checkLimit(
  userId,
  'finance/journal-entry'
);

if (!allowed) {
  throw new Error('Rate limit exceeded');
}
```

---

### EncryptionService

Encrypts sensitive financial data.

#### Methods

##### `encrypt(plaintext: string): Promise<EncryptedData>`

Encrypts sensitive data.

**Example:**
```typescript
import { EncryptionService } from '@/components/finance/EncryptionService';

const encryption = EncryptionService.getInstance();

const encrypted = await encryption.encrypt('1234567890');
// Store encrypted.ciphertext, encrypted.iv, encrypted.keyVersion
```

---

##### `decrypt(encryptedData: EncryptedData): Promise<string>`

Decrypts sensitive data.

**Example:**
```typescript
const plaintext = await encryption.decrypt({
  ciphertext: '...',
  iv: '...',
  keyVersion: 1
});
```

---

## Error Handling

All service methods throw errors that should be caught and handled appropriately.

**Common Error Types:**
- `ValidationError`: Invalid input data
- `NotFoundError`: Resource not found
- `PermissionError`: Insufficient permissions
- `RateLimitError`: Rate limit exceeded
- `DatabaseError`: Database operation failed

**Example Error Handling:**
```typescript
try {
  await gl.createJournalEntry(entry);
} catch (error) {
  if (error instanceof ValidationError) {
    toast.error('Invalid journal entry data');
  } else if (error instanceof PermissionError) {
    toast.error('You don't have permission to create journal entries');
  } else {
    toast.error('Failed to create journal entry');
    console.error(error);
  }
}
```

---

## React Hooks

The Finance Module provides React hooks for easy integration.

### useGeneralLedger

```typescript
import { useGeneralLedger } from '@/components/finance/hooks/useGeneralLedger';

function MyComponent() {
  const { createEntry, getBalance, isLoading } = useGeneralLedger();
  
  const handleCreate = async () => {
    await createEntry({...});
  };
  
  return <button onClick={handleCreate}>Create Entry</button>;
}
```

### useInvoices

```typescript
import { useInvoices } from '@/components/finance/hooks/useInvoices';

function InvoiceList() {
  const { invoices, isLoading, createInvoice } = useInvoices();
  
  if (isLoading) return <Loader />;
  
  return <div>{invoices.map(inv => <InvoiceCard key={inv.id} {...inv} />)}</div>;
}
```

---

## Performance Considerations

- **Transaction Processing**: < 100ms
- **Report Generation**: < 2 seconds
- **Dashboard Load**: < 500ms (with caching)
- **Rate Limits**: 100 requests/minute per user

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-30 | Initial API documentation |

---

## Support

For questions or issues, contact the development team or refer to:
- [Finance Module User Guide](./FINANCE_USER_GUIDE.md)
- [Finance Module Admin Guide](./FINANCE_ADMIN_GUIDE.md)
- [Disaster Recovery Procedures](./FINANCE_DISASTER_RECOVERY.md)
