import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RevenueManagerService } from '../RevenueManagerService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      }),
    },
  },
}));

describe('RevenueManagerService', () => {
  let revenueManager: RevenueManagerService;

  beforeEach(() => {
    revenueManager = new RevenueManagerService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordRevenue', () => {
    it('should record revenue journal entry successfully', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      // Mock journal entry creation
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'journal-789',
                entry_number: 'JE-2024-001',
                status: 'posted',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBe('journal-789');
      expect(result.entryNumber).toBe('JE-2024-001');
      expect(supabase.from).toHaveBeenCalledWith('finance_journal_entries');
    });

    it('should handle revenue recording errors', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      // Mock error
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error', code: 'DB_ERROR' },
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should validate revenue amount is positive', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: -100, // Invalid negative amount
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain('amount must be positive');
    });

    it('should validate required fields', async () => {
      const mockRevenueSource = {
        orderId: '',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain('orderId is required');
    });

    it('should process within 100ms requirement', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      // Mock fast response
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'journal-789',
                entry_number: 'JE-2024-001',
                status: 'posted',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const startTime = performance.now();
      await revenueManager.recordRevenue(mockRevenueSource);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100);
    });
  });

  describe('calculateCommission', () => {
    it('should calculate commission for an order', async () => {
      const orderId = 'order-123';
      const vendorId = 'vendor-456';

      // Mock vendor profile fetch
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                commission_model: 'percentage',
                commission_rate: 15,
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.calculateCommission(orderId, vendorId);

      expect(result.success).toBe(true);
      expect(result.commissionAmount).toBeGreaterThan(0);
    });

    it('should handle missing vendor profile', async () => {
      const orderId = 'order-123';
      const vendorId = 'vendor-456';

      // Mock vendor profile not found
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Vendor profile not found', code: 'PGRST116' },
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.calculateCommission(orderId, vendorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vendor profile not found');
    });
  });

  describe('processSubscriptionRevenue', () => {
    it('should process subscription revenue successfully', async () => {
      const vendorId = 'vendor-456';

      // Mock vendor profile with subscription data
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                subscription_plan: 'premium',
                subscription_fee: 500,
                subscription_status: 'active',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.processSubscriptionRevenue(vendorId);

      expect(result.success).toBe(true);
      expect(result.revenueAmount).toBe(500);
    });

    it('should handle inactive subscription', async () => {
      const vendorId = 'vendor-456';

      // Mock vendor profile with inactive subscription
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                subscription_plan: 'premium',
                subscription_fee: 500,
                subscription_status: 'inactive',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.processSubscriptionRevenue(vendorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('inactive');
    });
  });

  describe('error handling and rollback', () => {
    it('should rollback on journal entry creation failure', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      // Mock journal entry creation failure
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Transaction failed')),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      const mockRevenueSource = {
        orderId: 'order-123',
        vendorId: 'vendor-456',
        amount: 1000,
        type: 'order_completion' as const,
        description: 'Order #123 revenue',
        date: new Date('2024-01-15'),
      };

      // Mock network error
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await revenueManager.recordRevenue(mockRevenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
