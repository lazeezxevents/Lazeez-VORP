# Finance Module User Guide

## Welcome to Lazeez VORP Finance

This guide will help you navigate and use the Finance Module effectively. Whether you're recording transactions, managing invoices, or generating reports, this guide covers everything you need to know.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Recording Transactions](#recording-transactions)
4. [Managing Invoices](#managing-invoices)
5. [Expense Management](#expense-management)
6. [Receipt Vault](#receipt-vault)
7. [Financial Reports](#financial-reports)
8. [Budgets and Forecasts](#budgets-and-forecasts)
9. [Tips and Best Practices](#tips-and-best-practices)

---

## Getting Started

### Accessing the Finance Module

1. Log in to Lazeez VORP
2. Click on "Finance" in the main navigation menu
3. You'll see the Finance Dashboard with key metrics and quick actions

### User Roles

Different roles have different permissions:

- **Finance Admin**: Full access to all features
- **Finance Staff**: Can view and create transactions, manage invoices
- **Manager**: Can view department budgets and reports
- **Employee**: Can submit expenses and view personal reimbursements

---

## Dashboard Overview

The Finance Dashboard provides a quick overview of your financial health.

### Key Metrics

**Revenue**: Total revenue for the current period
**Expenses**: Total expenses for the current period
**Net Income**: Revenue minus expenses
**Cash Position**: Current cash balance

### Secondary Metrics

**MRR** (Monthly Recurring Revenue): Subscription revenue per month
**ARR** (Annual Recurring Revenue): MRR × 12
**Burn Rate**: Monthly cash consumption
**Runway**: Months of cash remaining

### Charts

**Revenue Trend**: 6-month revenue history
**Cash Flow Forecast**: Projected cash flow for next 6 months

### Quick Actions

- Create journal entry
- Record transaction
- Generate invoice
- Submit expense
- Upload receipt
- Generate report

---

## Recording Transactions

### Creating a Journal Entry

Journal entries are the foundation of accounting. They record debits and credits to maintain balanced books.

**Steps:**

1. Click "Create journal entry" from the dashboard
2. Enter the date and description
3. Add line items:
   - Select account from dropdown
   - Enter debit or credit amount
   - Add optional description
4. Ensure debits equal credits (shown at bottom)
5. Click "Save" to create the entry

**Example: Recording a Sale**
```
Date: April 30, 2026
Description: Customer payment received

Line Items:
- Cash Account: Debit 1,000
- Revenue Account: Credit 1,000

Total Debits: 1,000
Total Credits: 1,000 ✓ Balanced
```

### Recording a Transaction

For simpler operations, use the transaction recorder:

1. Click "Record transaction"
2. Select transaction type (Revenue, Expense, Transfer)
3. Enter amount and description
4. Select source module (if applicable)
5. Click "Record"

The system automatically creates the journal entry for you.

---

## Managing Invoices

### Creating an Invoice

**Steps:**

1. Navigate to "Invoices" section
2. Click "Create invoice"
3. Fill in invoice details:
   - Customer/Vendor name
   - Invoice date
   - Due date
   - Payment terms
4. Add line items:
   - Description
   - Quantity
   - Unit price
5. Review totals (subtotal, tax, total)
6. Click "Create invoice"

### Invoice Status

Invoices progress through these statuses:

- **Draft**: Not yet sent
- **Sent**: Delivered to customer
- **Paid**: Payment received
- **Overdue**: Past due date
- **Cancelled**: Voided invoice

### Recording Payments

When you receive payment:

1. Open the invoice
2. Click "Record payment"
3. Enter payment amount
4. Select payment date
5. Add payment method (optional)
6. Click "Save"

The system updates the invoice status automatically.

### Partial Payments

The system supports partial payments:

1. Record payment for partial amount
2. Invoice shows "Partially paid" status
3. Amount due updates automatically
4. Record additional payments as received

---

## Expense Management

### Submitting an Expense

**Steps:**

1. Navigate to "Expenses"
2. Click "Submit expense"
3. Fill in expense details:
   - Category (Travel, Meals, Supplies, etc.)
   - Amount
   - Date
   - Description
4. Upload receipt (drag and drop or click to browse)
5. Click "Submit"

Your expense is now pending approval.

### Expense Categories

Common categories:
- Travel
- Meals and entertainment
- Office supplies
- Software subscriptions
- Professional services
- Marketing
- Utilities

### Tracking Expense Status

**Draft**: Not yet submitted
**Pending**: Awaiting approval
**Approved**: Approved for reimbursement
**Rejected**: Not approved (see reason)
**Reimbursed**: Payment processed

### Viewing Your Expenses

1. Navigate to "My Expenses"
2. Filter by status, date, or category
3. Click on expense to view details
4. Download receipt if needed

---

## Receipt Vault

The Receipt Vault uses AI to automatically extract data from receipts.

### Uploading a Receipt

**Steps:**

1. Navigate to "Receipt Vault"
2. Click "Upload receipt" or drag and drop
3. Select category:
   - Riders: Delivery-related receipts
   - Vendors: Vendor payments
   - General: Other business expenses
4. Wait for AI processing (usually < 10 seconds)
5. Review extracted data

### AI Data Extraction

The system automatically extracts:
- Merchant name
- Date
- Total amount
- Tax amount
- Line items
- Payment method

**Confidence Score**: Shows extraction accuracy
- High (≥70%): Auto-processed
- Low (<70%): Requires manual review

### Reviewing Extracted Data

If confidence is low:

1. Click on the receipt
2. Review extracted fields
3. Correct any errors
4. Click "Confirm"

### Linking Receipts

Link receipts to:
- Transactions
- Expenses
- Orders
- Invoices

This creates a complete audit trail.

### Searching Receipts

Search by:
- Merchant name
- Date range
- Amount range
- Category
- Tags
- Linked entity

---

## Financial Reports

### Profit & Loss Statement

Shows revenue, expenses, and profitability.

**Generating P&L:**

1. Navigate to "Reports"
2. Select "Profit & Loss"
3. Choose date range
4. Click "Generate"

**Understanding P&L:**

```
Revenue
  Subscription Revenue: 10,000
  Commission Revenue: 5,000
  Total Revenue: 15,000

Expenses
  Cost of Goods Sold: 6,000
  Operating Expenses: 4,000
  Total Expenses: 10,000

Gross Profit: 9,000 (60% margin)
Operating Income: 5,000 (33% margin)
Net Income: 5,000 (33% margin)
```

### Cash Flow Statement

Shows cash inflows and outflows.

**Categories:**

**Operating Activities**: Day-to-day business
**Investing Activities**: Asset purchases/sales
**Financing Activities**: Loans, equity

**Example:**
```
Operating Activities
  Cash from customers: 15,000
  Cash to suppliers: (8,000)
  Net operating cash: 7,000

Investing Activities
  Equipment purchase: (2,000)
  Net investing cash: (2,000)

Financing Activities
  Loan proceeds: 5,000
  Net financing cash: 5,000

Net Cash Change: 10,000
Beginning Cash: 20,000
Ending Cash: 30,000
```

### Aging Report

Shows outstanding receivables by age.

**Age Buckets:**
- Current: 0-30 days
- 30 days: 31-60 days
- 60 days: 61-90 days
- 90+ days: Over 90 days

Use this to identify overdue invoices and follow up with customers.

### Exporting Reports

All reports can be exported:

1. Generate the report
2. Click "Export"
3. Choose format:
   - PDF: Professional formatting
   - Excel: Editable with formulas
   - CSV: Raw data for analysis

---

## Budgets and Forecasts

### Creating a Budget

**Steps:**

1. Navigate to "Budgets"
2. Click "Create budget"
3. Select fiscal year
4. Choose budget type:
   - Department budget
   - Project budget
   - Overall budget
5. Allocate amounts by category
6. Set variance thresholds
7. Click "Save"

### Monitoring Budget Performance

The dashboard shows:
- Budget vs. Actual
- Variance (amount and %)
- Trend indicators
- Alerts for overages

**Color Coding:**
- Green: Under budget
- Yellow: Within 10% of budget
- Red: Over budget

### Cash Flow Forecasting

The system forecasts cash flow based on:
- Historical patterns
- Scheduled payments
- Recurring revenue
- Seasonal trends

**Viewing Forecast:**

1. Navigate to "Forecasts"
2. Select forecast period (3, 6, or 12 months)
3. Review projected cash position
4. Adjust assumptions if needed

---

## Tips and Best Practices

### Daily Tasks

- Record transactions promptly
- Upload receipts same day
- Review pending approvals

### Weekly Tasks

- Reconcile bank statements
- Review aging report
- Follow up on overdue invoices

### Monthly Tasks

- Generate P&L statement
- Review budget performance
- Analyze cash flow trends
- Close accounting period

### Best Practices

**Accuracy**
- Double-check amounts before saving
- Ensure debits equal credits
- Attach supporting documents

**Timeliness**
- Record transactions within 24 hours
- Submit expenses weekly
- Pay invoices before due date

**Organization**
- Use consistent descriptions
- Tag transactions appropriately
- Link receipts to transactions

**Security**
- Never share login credentials
- Log out when finished
- Report suspicious activity

### Keyboard Shortcuts

- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + N`: New transaction
- `Ctrl/Cmd + I`: New invoice
- `Esc`: Close dialog

---

## Common Questions

**Q: How do I correct a mistake in a journal entry?**
A: Create a reversing entry, then create the correct entry. Never delete posted entries.

**Q: Can I delete an invoice?**
A: Draft invoices can be deleted. Sent invoices should be cancelled instead.

**Q: How long does AI receipt processing take?**
A: Usually 5-10 seconds. Complex receipts may take up to 30 seconds.

**Q: What if the AI extracts wrong data?**
A: Review and correct the data manually. The system learns from corrections.

**Q: How do I handle foreign currency?**
A: Currently, the system uses PKR only. Multi-currency support is planned.

**Q: Can I schedule recurring invoices?**
A: Yes, use the "Recurring" option when creating an invoice.

---

## Getting Help

**In-App Help**
- Click the "?" icon in any screen
- Hover over fields for tooltips
- Check the help panel on the right

**Support**
- Email: support@lazeez.com
- Phone: [Support Number]
- Live Chat: Available 9 AM - 6 PM

**Training**
- Video tutorials: [Link]
- Webinars: [Schedule]
- Documentation: [Link]

---

## Appendix: Glossary

**Account**: A category for tracking financial transactions
**Debit**: Left side of accounting equation (increases assets)
**Credit**: Right side of accounting equation (increases liabilities)
**Journal Entry**: Record of debits and credits
**Ledger**: Collection of all accounts
**Trial Balance**: Report showing all account balances
**Aging**: Time since invoice was issued
**Accrual**: Recording revenue/expense when earned/incurred
**Cash Basis**: Recording when cash changes hands

---

*Last Updated: April 30, 2026*
*Version: 1.0*
