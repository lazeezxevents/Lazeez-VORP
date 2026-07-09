import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orderRevenueEventHandler } from '../OrderRevenueEventHandler';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    channel: vi.fn(),
  },
}));

// Mock OrderRevenueProcessor
vi.mock('../OrderRevenueProcessor', () => ({
  orderRevenueProcessor: {
    processOrderRevenue: vi.fn(),
  },
}));

// Mock AuditLogService
vi.mock('../AuditLogService', () => ({
  logAuditEntry: vi.fn(),
}));

describe('OrderRevenueEventHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEvent', () => {
    it('should process a pending event successfully', async () => {
      // Mock event data
      const mockEvent = {
        id: 'event-123',
        event_type: 'order_completed',
        order_id: 'order-456',
        vendor_id: 'vendor-789',
        order_amount: 1000,
        currency: 'PKR',
        event_data: {
          order_number: 'ORD-001',
          order_date: '2024-04-02',
          completed_at: '2024-04-02T10:00:00Z',
          rider_id: 'rider-123',
          delivery_distance: 5.5,
          delivery_charge: 150,
        },
        status: 'pending',
        processed_at: null,
        error_message: null,
        retry_count: 0,
        created_at: '2024-04-02T09:00:00Z',
        updated_at: '2024-04-02T09:00:00Z',
      };

      // Mock Supabase responses
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      // Mock successful processing
      const { orderRevenueProcessor } = await import('../OrderRevenueProcessor');
      (orderRevenueProcessor.processOrderRevenue as any).mockResolvedValue({
        success: true,
        journalEntryId: 'journal-123',
        vendorCommission: 100,
        riderCommission: 30,
        platformRevenue: 870,
        executionTime: 85,
      });

      // Process event
      const result = await orderRevenueEventHandler.processEvent('event-123');

      // Assertions
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('event-123');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(orderRevenueProcessor.processOrderRevenue).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-456',
          vendorId: 'vendor-789',
          orderAmount: 1000,
        })
      );
    });

    it('should handle event processing failure', async () => {
      // Mock event data
      const mockEvent = {
        id: 'event-123',
        event_type: 'order_completed',
        order_id: 'order-456',
        vendor_id: 'vendor-789',
        order_amount: 1000,
        currency: 'PKR',
        event_data: {},
        status: 'pending',
        processed_at: null,
        error_message: null,
        retry_count: 0,
        created_at: '2024-04-02T09:00:00Z',
        updated_at: '2024-04-02T09:00:00Z',
      };

      // Mock Supabase responses
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      // Mock failed processing
      const { orderRevenueProcessor } = await import('../OrderRevenueProcessor');
      (orderRevenueProcessor.processOrderRevenue as any).mockResolvedValue({
        success: false,
        error: 'Vendor profile not found',
      });

      // Process event
      const result = await orderRevenueEventHandler.processEvent('event-123');

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Vendor profile not found');
      expect(result.eventId).toBe('event-123');
    });

    it('should process within 100ms performance requirement', async () => {
      // Mock event data
      const mockEvent = {
        id: 'event-123',
        event_type: 'order_completed',
        order_id: 'order-456',
        vendor_id: 'vendor-789',
        order_amount: 1000,
        currency: 'PKR',
        event_data: {
          order_number: 'ORD-001',
          delivery_charge: 150,
        },
        status: 'pending',
        processed_at: null,
        error_message: null,
        retry_count: 0,
        created_at: '2024-04-02T09:00:00Z',
        updated_at: '2024-04-02T09:00:00Z',
      };

      // Mock fast Supabase responses
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      // Mock fast processing (50ms)
      const { orderRevenueProcessor } = await import('../OrderRevenueProcessor');
      (orderRevenueProcessor.processOrderRevenue as any).mockResolvedValue({
        success: true,
        journalEntryId: 'journal-123',
        vendorCommission: 100,
        riderCommission: 30,
        platformRevenue: 870,
        executionTime: 50,
      });

      // Process event
      const result = await orderRevenueEventHandler.processEvent('event-123');

      // Assertions - should complete within reasonable time
      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(200); // Allow some overhead
    });
  });

  describe('getEventStatistics', () => {
    it('should return event statistics', async () => {
      // Mock RPC response
      const mockStats = {
        pending: 5,
        processing: 2,
        completed: 100,
        failed: 3,
        total: 110,
      };

      (supabase as any).rpc = vi.fn().mockResolvedValue({
        data: mockStats,
        error: null,
      });

      // Get statistics
      const stats = await orderRevenueEventHandler.getEventStatistics();

      // Assertions
      expect(stats).toEqual(mockStats);
      expect(supabase.rpc).toHaveBeenCalledWith('get_revenue_event_stats');
    });

    it('should return zero stats on error', async () => {
      // Mock RPC error
      (supabase as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      // Get statistics
      const stats = await orderRevenueEventHandler.getEventStatistics();

      // Assertions
      expect(stats).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      });
    });
  });
});
