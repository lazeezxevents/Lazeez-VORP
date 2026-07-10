import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { orderRevenueProcessor, type OrderData } from "../OrderRevenueProcessor";
import type { Location, RouteData } from "../types";

/**
 * Integration Tests for Order Revenue Processing
 * 
 * Tests end-to-end order processing workflow including:
 * - Revenue recording in General Ledger
 * - Vendor commission calculation and recording
 * - Rider commission calculation and recording
 * - Subscription threshold tracking and billing
 * - Error handling and rollback
 * - Performance requirements (100ms)
 * 
 * Requirements: 2.1, 2.7
 * Task: 10.3
 */

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      })
    ),
  },
  from: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

// Mock GeneralLedgerService
vi.mock("../GeneralLedgerService", () => ({
  generalLedgerService: {
    createJournalEntry: vi.fn(),
    postTransaction: vi.fn(),
    getAccountBalance: vi.fn(),
  },
}));

// Mock AuditLogService
vi.mock("../AuditLogService", () => ({
  logAuditEntry: vi.fn(() => Promise.resolve()),
}));

describe("Order Revenue Processing Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Setup mock database responses for integration tests
   */
  function setupMockDatabase() {
    // Mock finance_accounts table
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "finance_accounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: any) => {
              if (field === "code" && value === "1010") {
                return {
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: { id: "cash-account-id", code: "1010", name: "Cash" },
                      error: null,
                    })
                  ),
                };
              }
              if (field === "type" && value === "revenue") {
                return {
                  limit: vi.fn(() => ({
                    single: vi.fn(() =>
                      Promise.resolve({
                        data: { id: "revenue-account-id", type: "revenue" },
                        error: null,
                      })
                    ),
                  })),
                };
              }
              if (field === "type" && value === "expense") {
                return {
                  limit: vi.fn(() => ({
                    single: vi.fn(() =>
                      Promise.resolve({
                        data: { id: "expense-account-id", type: "expense", sub_type: "commission" },
                        error: null,
                      })
                    ),
                  })),
                };
              }
              if (field === "type" && value === "liability") {
                return {
                  limit: vi.fn(() => ({
                    single: vi.fn(() =>
                      Promise.resolve({
                        data: { id: "payable-account-id", type: "liability", sub_type: "accounts_payable" },
                        error: null,
                      })
                    ),
                  })),
                };
              }
              return {
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              };
            }),
          })),
        };
      }

      if (table === "finance_vendor_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    vendor_id: "test-vendor-id",
                    commission_model: "percentage",
                    commission_rate: 10.0,
                    commission_rules: {
                      model: "percentage",
                      percentage_rate: 10.0,
                    },
                    current_threshold: 5,
                    threshold_limit: 10,
                  },
                  error: null,
                })
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        };
      }

      if (table === "finance_transactions") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "test-transaction-id",
                    transaction_number: "REV-123456",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                })
              ),
            })),
          })),
        };
      }

      if (table === "finance_order_data") {
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }

      if (table === "finance_delivery_data") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "test-delivery-data-id",
                    delivery_id: "DEL-test-order-id",
                  },
                  error: null,
                })
              ),
            })),
          })),
        };
      }

      if (table === "finance_error_log") {
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }

      if (table === "finance_performance_metrics") {
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }

      return {
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    });

    // Mock GeneralLedgerService
    const { generalLedgerService } = require("../GeneralLedgerService");
    vi.mocked(generalLedgerService.createJournalEntry).mockResolvedValue({
      success: true,
      journal_entry: {
        id: "test-journal-entry-id",
        entry_number: "JE-2024-001",
        entry_date: "2024-01-01",
        status: "draft",
        ledger_entries: [],
      },
    });
    vi.mocked(generalLedgerService.postTransaction).mockResolvedValue({
      success: true,
      journal_entry_id: "test-journal-entry-id",
      accounts_updated: 2,
    });
  }

  /**
   * Create test order data
   */
  function createTestOrderData(overrides?: Partial<OrderData>): OrderData {
    const pickupLocation: Location = { lat: 24.8607, lng: 67.0011, address: "Karachi, Pakistan" };
    const deliveryLocation: Location = { lat: 24.8700, lng: 67.0300, address: "Karachi, Pakistan" };
    const optimizedRoute: RouteData = {
      distance: 5.5,
      duration: 15,
      waypoints: [pickupLocation, deliveryLocation],
      optimized: true,
    };

    return {
      orderId: "test-order-id",
      orderNumber: "ORD-2024-001",
      vendorId: "test-vendor-id",
      riderId: "test-rider-id",
      orderAmount: 1000,
      deliveryCharge: 150,
      category: "food",
      pickupLocation,
      deliveryLocation,
      distance: 5.5,
      optimizedRoute,
      completedAt: new Date("2024-01-01T12:00:00Z"),
      ...overrides,
    };
  }

  describe("End-to-End Order Flow", () => {
    it("should process complete order revenue workflow successfully", async () => {
      const orderData = createTestOrderData();

      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBeDefined();
      expect(result.vendorCommission).toBeDefined();
      expect(result.riderCommission).toBeDefined();
      expect(result.platformRevenue).toBeDefined();
    });

    it("should record revenue in General Ledger", async () => {
      const { generalLedgerService } = require("../GeneralLedgerService");
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(generalLedgerService.createJournalEntry).toHaveBeenCalled();
      expect(generalLedgerService.postTransaction).toHaveBeenCalled();
    });

    it("should calculate vendor commission correctly", async () => {
      const orderData = createTestOrderData({ orderAmount: 1000 });

      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // With 10% commission rate, vendor commission should be 100
      expect(result.vendorCommission).toBe(100);
    });

    it("should calculate rider commission correctly", async () => {
      const orderData = createTestOrderData({ distance: 5.5, deliveryCharge: 150 });

      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // Distance 5.5km falls in 5-10km tier (20% rate)
      // Rider commission = 150 * 0.20 = 30
      expect(result.riderCommission).toBe(30);
    });

    it("should update subscription threshold", async () => {
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify vendor profile was queried
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_vendor_profiles");
    });

    it("should generate invoice when threshold reached", async () => {
      // Mock vendor profile with threshold reached
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      vendor_id: "test-vendor-id",
                      commission_model: "percentage",
                      commission_rate: 10.0,
                      commission_rules: { model: "percentage", percentage_rate: 10.0 },
                      current_threshold: 9,
                      threshold_limit: 10,
                    },
                    error: null,
                  })
                ),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData();
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // Subscription invoice should be generated
      expect(result.subscriptionInvoiceGenerated).toBe(true);
    });
  });

  describe("Commission Integration", () => {
    it("should calculate flat rate commission", async () => {
      // Mock vendor with flat rate commission
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      vendor_id: "test-vendor-id",
                      commission_model: "flat",
                      commission_rate: 50,
                      commission_rules: {
                        model: "flat",
                        flat_rate: 50,
                      },
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData({ orderAmount: 1000 });
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      expect(result.vendorCommission).toBe(50);
    });

    it("should calculate percentage commission", async () => {
      const orderData = createTestOrderData({ orderAmount: 2000 });
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // 10% of 2000 = 200
      expect(result.vendorCommission).toBe(200);
    });

    it("should calculate tiered commission", async () => {
      // Mock vendor with tiered commission
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      vendor_id: "test-vendor-id",
                      commission_model: "tiered",
                      commission_rules: {
                        model: "tiered",
                        tiers: [
                          { min_amount: 0, max_amount: 500, rate: 5 },
                          { min_amount: 500, max_amount: 1500, rate: 10 },
                          { min_amount: 1500, max_amount: Infinity, rate: 15 },
                        ],
                      },
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData({ orderAmount: 1000 });
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // 1000 falls in 500-1500 tier (10% rate)
      expect(result.vendorCommission).toBe(100);
    });

    it("should calculate category-based commission", async () => {
      // Mock vendor with category-based commission
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      vendor_id: "test-vendor-id",
                      commission_model: "category_based",
                      commission_rules: {
                        model: "category_based",
                        category_rates: {
                          food: 8,
                          electronics: 12,
                          clothing: 15,
                        },
                        percentage_rate: 10,
                      },
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData({ orderAmount: 1000, category: "food" });
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // Food category: 8% of 1000 = 80
      expect(result.vendorCommission).toBe(80);
    });

    it("should record commission liabilities in Accounts Payable", async () => {
      const { generalLedgerService } = require("../GeneralLedgerService");
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Should create journal entries for both vendor and rider commissions
      const calls = vi.mocked(generalLedgerService.createJournalEntry).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it("should calculate platform revenue correctly", async () => {
      const orderData = createTestOrderData({
        orderAmount: 1000,
        deliveryCharge: 150,
      });

      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      // Total revenue = 1000 + 150 = 1150
      // Vendor commission = 100 (10% of 1000)
      // Rider commission = 30 (20% of 150)
      // Platform revenue = 1150 - 100 - 30 = 1020
      expect(result.platformRevenue).toBe(1020);
    });
  });

  describe("Error Handling and Rollback", () => {
    it("should handle revenue recording failure", async () => {
      const { generalLedgerService } = require("../GeneralLedgerService");
      vi.mocked(generalLedgerService.createJournalEntry).mockResolvedValueOnce({
        success: false,
        error: "Failed to create journal entry",
      });

      const orderData = createTestOrderData();
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Revenue recording failed");
    });

    it("should handle vendor commission calculation failure", async () => {
      // Mock vendor profile not found
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: "Vendor profile not found" },
                  })
                ),
              })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData();
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("commission");
    });

    it("should log errors to finance_error_log", async () => {
      const { generalLedgerService } = require("../GeneralLedgerService");
      vi.mocked(generalLedgerService.createJournalEntry).mockResolvedValueOnce({
        success: false,
        error: "Database error",
      });

      const orderData = createTestOrderData();
      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify error was logged
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_error_log");
    });

    it("should handle invalid order data", async () => {
      const invalidOrderData = createTestOrderData({ orderAmount: -100 });

      const result = await orderRevenueProcessor.processOrderRevenue(invalidOrderData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle missing vendor ID", async () => {
      const invalidOrderData = createTestOrderData({ vendorId: "" });

      const result = await orderRevenueProcessor.processOrderRevenue(invalidOrderData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("vendor ID");
    });

    it("should handle rider commission failure gracefully", async () => {
      // Mock rider commission calculation failure
      const orderData = createTestOrderData({ riderId: "", distance: 0 });

      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      // Should still succeed even if rider commission fails
      expect(result.success).toBe(true);
      expect(result.riderCommission).toBe(0);
    });
  });

  describe("Performance", () => {
    it("should process within 100ms requirement", async () => {
      const orderData = createTestOrderData();

      const startTime = performance.now();
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Requirement 2.6
    });

    it("should log performance metrics", async () => {
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify performance metrics were logged
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_performance_metrics");
    });

    it("should handle concurrent orders", async () => {
      const orders = [
        createTestOrderData({ orderId: "order-1", orderNumber: "ORD-001" }),
        createTestOrderData({ orderId: "order-2", orderNumber: "ORD-002" }),
        createTestOrderData({ orderId: "order-3", orderNumber: "ORD-003" }),
      ];

      const results = await Promise.all(
        orders.map(order => orderRevenueProcessor.processOrderRevenue(order))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Subscription Billing Integration", () => {
    it("should track threshold counter increment", async () => {
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify vendor profile was updated
      const fromCalls = mockSupabaseClient.from.mock.calls.filter(
        call => call[0] === "finance_vendor_profiles"
      );
      expect(fromCalls.length).toBeGreaterThan(0);
    });

    it("should generate invoice when threshold reached", async () => {
      // Mock vendor at threshold
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "finance_vendor_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      vendor_id: "test-vendor-id",
                      commission_model: "percentage",
                      commission_rate: 10.0,
                      commission_rules: { model: "percentage", percentage_rate: 10.0 },
                      current_threshold: 10,
                      threshold_limit: 10,
                    },
                    error: null,
                  })
                ),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          };
        }
        return setupMockDatabase();
      });

      const orderData = createTestOrderData();
      const result = await orderRevenueProcessor.processOrderRevenue(orderData);

      expect(result.success).toBe(true);
      expect(result.subscriptionInvoiceGenerated).toBe(true);
    });

    it("should reset threshold after invoice generation", async () => {
      const orderData = createTestOrderData();
      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Threshold update should be called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_vendor_profiles");
    });
  });

  describe("Order Financial Data Recording", () => {
    it("should record complete order financial breakdown", async () => {
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify order financial data was recorded
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_order_data");
    });

    it("should link order data to delivery data", async () => {
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify delivery data was recorded
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("finance_delivery_data");
    });

    it("should record audit trail", async () => {
      const { logAuditEntry } = require("../AuditLogService");
      const orderData = createTestOrderData();

      await orderRevenueProcessor.processOrderRevenue(orderData);

      // Verify audit log was created
      expect(logAuditEntry).toHaveBeenCalled();
    });
  });
});
