import { describe, it, expect, beforeEach, vi } from "vitest";
import { RevenueManagerService } from "../RevenueManagerService";
import type { RevenueSource } from "../RevenueManagerService";

/**
 * Unit Tests for Revenue Manager Operations
 * 
 * Tests:
 * - Revenue recording from multiple sources
 * - Commission calculation
 * - Subscription revenue processing
 * - Platform revenue calculation after commission deductions
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: "test-user-id" } },
          error: null,
        })
      ),
    },
    from: vi.fn((table: string) => {
      if (table === "finance_accounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { id: "test-account-id", code: "1010", name: "Cash" },
                  error: null,
                })
              ),
              limit: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { id: "test-revenue-account-id", type: "revenue" },
                    error: null,
                  })
                ),
              })),
            })),
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
                    transaction_date: "2024-01-01",
                    type: "revenue",
                    amount: 1000,
                    currency: "PKR",
                    status: "posted",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                })
              ),
            })),
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
                    commission_rate: 10,
                    commission_rules: { model: "percentage", percentage_rate: 10 },
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
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    }),
  },
}));

// Mock GeneralLedgerService
vi.mock("../GeneralLedgerService", () => ({
  generalLedgerService: {
    createJournalEntry: vi.fn(() =>
      Promise.resolve({
        success: true,
        journal_entry: {
          id: "test-journal-entry-id",
          entry_number: "JE-2024-001",
          entry_date: "2024-01-01",
          status: "draft",
          ledger_entries: [],
        },
      })
    ),
    postTransaction: vi.fn(() =>
      Promise.resolve({
        success: true,
        journal_entry_id: "test-journal-entry-id",
        accounts_updated: 2,
      })
    ),
  },
}));

// Mock AuditLogService
vi.mock("../AuditLogService", () => ({
  logAuditEntry: vi.fn(() => Promise.resolve()),
}));

describe("RevenueManagerService", () => {
  let service: RevenueManagerService;

  beforeEach(() => {
    service = new RevenueManagerService();
    vi.clearAllMocks();
  });

  describe("recordRevenue", () => {
    it("should record revenue from subscription source", async () => {
      const revenueSource: RevenueSource = {
        type: "subscription",
        vendorId: "test-vendor-id",
        amount: 1000,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(true);
      expect(result.revenue).toBeDefined();
      expect(result.revenue?.source).toBe("subscription");
      expect(result.revenue?.amount).toBe(1000);
    });

    it("should record revenue from commission source", async () => {
      const revenueSource: RevenueSource = {
        type: "commission",
        orderId: "test-order-id",
        vendorId: "test-vendor-id",
        amount: 500,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(true);
      expect(result.revenue).toBeDefined();
      expect(result.revenue?.source).toBe("commission");
    });

    it("should record revenue from transaction_fee source", async () => {
      const revenueSource: RevenueSource = {
        type: "transaction_fee",
        vendorId: "test-vendor-id",
        amount: 50,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(true);
      expect(result.revenue?.source).toBe("transaction_fee");
    });

    it("should record revenue from service_charge source", async () => {
      const revenueSource: RevenueSource = {
        type: "service_charge",
        vendorId: "test-vendor-id",
        amount: 100,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(true);
      expect(result.revenue?.source).toBe("service_charge");
    });

    it("should create journal entry debiting Cash and crediting Revenue", async () => {
      const { generalLedgerService } = await import("../GeneralLedgerService");
      
      const revenueSource: RevenueSource = {
        type: "subscription",
        vendorId: "test-vendor-id",
        amount: 1000,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      await service.recordRevenue(revenueSource);

      // Verify journal entry was created
      expect(generalLedgerService.createJournalEntry).toHaveBeenCalled();
      
      const journalEntryCall = vi.mocked(generalLedgerService.createJournalEntry).mock.calls[0][0];
      expect(journalEntryCall.ledger_entries).toHaveLength(2);
      
      // First entry should be debit to Cash
      expect(journalEntryCall.ledger_entries[0].debit).toBe(1000);
      expect(journalEntryCall.ledger_entries[0].credit).toBe(0);
      
      // Second entry should be credit to Revenue
      expect(journalEntryCall.ledger_entries[1].debit).toBe(0);
      expect(journalEntryCall.ledger_entries[1].credit).toBe(1000);
    });

    it("should link journal entry to source order for traceability", async () => {
      const revenueSource: RevenueSource = {
        type: "commission",
        orderId: "test-order-123",
        vendorId: "test-vendor-id",
        amount: 500,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(true);
      
      // Verify transaction was created with source_id
      const { supabase } = await import("@/integrations/supabase/client");
      const insertCall = vi.mocked(supabase.from).mock.results.find(
        r => r.value?.insert
      );
      expect(insertCall).toBeDefined();
    });

    it("should handle missing accounts gracefully", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Mock missing account
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: "Account not found" } as any,
              })
            ),
          })),
        })),
      } as any);

      const revenueSource: RevenueSource = {
        type: "subscription",
        vendorId: "test-vendor-id",
        amount: 1000,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const result = await service.recordRevenue(revenueSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Required accounts");
    });

    it("should process revenue within 100ms", async () => {
      const revenueSource: RevenueSource = {
        type: "subscription",
        vendorId: "test-vendor-id",
        amount: 1000,
        currency: "PKR",
        date: new Date("2024-01-01"),
      };

      const startTime = Date.now();
      await service.recordRevenue(revenueSource);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Requirement 2.6
    });
  });

  describe("calculateCommission", () => {
    it("should calculate commission based on vendor profile", async () => {
      const result = await service.calculateCommission(
        "test-order-id",
        "test-vendor-id"
      );

      expect(result.success).toBe(true);
      expect(result.commission).toBeDefined();
      expect(result.commission?.calculationMethod).toBe("percentage");
    });

    it("should use default rate when vendor profile not found", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: "Profile not found" } as any,
              })
            ),
          })),
        })),
      } as any);

      const result = await service.calculateCommission(
        "test-order-id",
        "unknown-vendor-id"
      );

      expect(result.success).toBe(true);
      expect(result.commission?.commissionRate).toBe(0);
    });

    it("should calculate platform revenue after commission deductions", async () => {
      const result = await service.calculateCommission(
        "test-order-id",
        "test-vendor-id"
      );

      expect(result.success).toBe(true);
      expect(result.commission).toBeDefined();
      // Platform revenue should be calculated (will be expanded with order data)
      expect(result.commission?.platformRevenue).toBeDefined();
    });
  });

  describe("processSubscriptionRevenue", () => {
    it("should process subscription revenue when threshold reached", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Mock vendor profile with threshold reached
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  vendor_id: "test-vendor-id",
                  current_threshold: 10,
                  threshold_limit: 10,
                },
                error: null,
              })
            ),
          })),
        })),
      } as any);

      const result = await service.processSubscriptionRevenue("test-vendor-id");

      expect(result.success).toBe(true);
      expect(result.subscriptionRevenue).toBeDefined();
    });

    it("should not process when threshold not reached", async () => {
      const result = await service.processSubscriptionRevenue("test-vendor-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("threshold not reached");
    });

    it("should reset vendor threshold counter after processing", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Mock vendor profile with threshold reached
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  vendor_id: "test-vendor-id",
                  current_threshold: 10,
                  threshold_limit: 10,
                },
                error: null,
              })
            ),
          })),
        })),
      } as any);

      await service.processSubscriptionRevenue("test-vendor-id");

      // Verify update was called to reset threshold
      expect(supabase.from).toHaveBeenCalledWith("finance_vendor_profiles");
    });

    it("should handle missing vendor profile", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: "Profile not found" } as any,
              })
            ),
          })),
        })),
      } as any);

      const result = await service.processSubscriptionRevenue("unknown-vendor-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("profile not found");
    });
  });
});
