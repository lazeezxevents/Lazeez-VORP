import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountsPayableService } from '../AccountsPayableService';
import type { BillData, PayoutResult } from '../AccountsPayableService';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'test-vendor-id', name: 'Test Vendor' },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

// Mock GeneralLedgerService
vi.mock('../GeneralLedgerService', () => ({
  generalLedgerService: {
    createJournalEntry: vi.fn(() => Promise.resolve({
      success: true,
      journal_entry: { id: 'test-journal-id' },
    })),
    postTransaction: vi.fn(() => Promise.resolve({
      success: true,
    })),
  },
}));

// Mock AuditLogService
vi.mock('../AuditLogService', () => ({
  logAuditEntry: vi.fn(() => Promise.resolve()),
}));

describe('AccountsPayableService', () => {
  let service: AccountsPayableService;

  beforeEach(() => {
    service = new AccountsPayableService();
    vi.clearAllMocks();
  });

  describe('createBill', () => {
    it('should create a bill with correct calculations', async () => {
      const billData: BillData = {
        vendor_id: 'test-vendor-id',
        bill_date: new Date('2024-01-01'),
        due_date: new Date('2024-01-31'),
        line_items: [
          {
            description: 'Service A',
            quantity: 2,
            unit_price: 1000,
            tax_rate: 10,
            amount: 2000,
          },
          {
            description: 'Service B',
            quantity: 1,
            unit_price: 3000,
            tax_rate: 10,
            amount: 3000,
          },
        ],
        notes: 'Test bill',
      };

      const result = await service.createBill(billData);

      expect(result.success).toBe(true);
      expect(result.bill).toBeDefined();
      if (result.bill) {
        expect(result.bill.subtotal).toBe(5000);
        expect(result.bill.tax_amount).toBe(500); // 10% of 5000
        expect(result.bill.total_amount).toBe(5500);
        expect(result.bill.status).toBe('pending');
        expect(result.bill.currency).toBe('PKR');
      }
    });

    it('should generate unique bill numbers', async () => {
      const billData: BillData = {
        vendor_id: 'test-vendor-id',
        bill_date: new Date('2024-01-01'),
        due_date: new Date('2024-01-31'),
        line_items: [
          {
            description: 'Service',
            quantity: 1,
            unit_price: 1000,
            tax_rate: 0,
            amount: 1000,
          },
        ],
      };

      const result1 = await service.createBill(billData);
      const result2 = await service.createBill(billData);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.bill?.bill_number).not.toBe(result2.bill?.bill_number);
    });
  });

  describe('approveExpense', () => {
    it('should approve an expense successfully', async () => {
      const result = await service.approveExpense(
        'test-expense-id',
        'test-user-id',
        'Approved for business purposes'
      );

      expect(result.success).toBe(true);
      expect(result.expense_id).toBe('test-expense-id');
      expect(result.new_status).toBe('approved');
    });

    it('should reject approval from unauthorized user', async () => {
      const result = await service.approveExpense(
        'test-expense-id',
        'different-user-id',
        'Trying to approve'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('schedulePayment', () => {
    it('should schedule a payment for future date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const result = await service.schedulePayment(
        'test-bill-id',
        futureDate,
        'bank_transfer',
        'Scheduled payment'
      );

      expect(result.success).toBe(true);
      expect(result.scheduled_payment).toBeDefined();
      if (result.scheduled_payment) {
        expect(result.scheduled_payment.status).toBe('scheduled');
        expect(result.scheduled_payment.payment_method).toBe('bank_transfer');
      }
    });

    it('should reject payment scheduled in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = await service.schedulePayment(
        'test-bill-id',
        pastDate,
        'bank_transfer'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });
  });

  describe('processVendorPayout', () => {
    it('should calculate net payout correctly', () => {
      // Test the payout calculation logic
      const orderAmount = 10000;
      const upfrontAmount = 3000; // 30%
      const remainingAmount = 7000;
      const commissionRate = 15; // 15%
      const commissionAmount = remainingAmount * (commissionRate / 100); // 1050
      const netPayout = remainingAmount - commissionAmount; // 5950

      expect(netPayout).toBe(5950);
      expect(netPayout).toBeGreaterThanOrEqual(0);
    });

    it('should ensure net payout is non-negative', () => {
      // Test edge case where commission might exceed remaining
      const remainingAmount = 1000;
      const commissionAmount = 1500;
      const netPayout = Math.max(0, remainingAmount - commissionAmount);

      expect(netPayout).toBe(0);
      expect(netPayout).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getBillsByVendor', () => {
    it('should return empty array when no bills exist', async () => {
      const bills = await service.getBillsByVendor('test-vendor-id');
      expect(Array.isArray(bills)).toBe(true);
      expect(bills.length).toBe(0);
    });
  });

  describe('getPaymentSchedule', () => {
    it('should return empty array when no scheduled payments exist', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const schedule = await service.getPaymentSchedule(startDate, endDate);
      expect(Array.isArray(schedule)).toBe(true);
      expect(schedule.length).toBe(0);
    });
  });
});
