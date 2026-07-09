import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeneralLedgerService } from "../GeneralLedgerService";
import type { CreateJournalEntryInput } from "../types";

/**
 * Unit Tests for General Ledger Operations
 * 
 * Tests:
 * - Journal entry creation and validation
 * - Transaction posting and rollback
 * - Account balance calculations
 * - Trial balance generation
 * 
 * Requirements: 1.2, 1.3, 1.5
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
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: "test-journal-entry-id",
                entry_number: "2024000001",
                entry_date: "2024-01-01",
                description: "Test entry",
                reference: "TEST-001",
                status: "draft",
                created_by: "test-user-id",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })
          ),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: "test-account-id",
                code: "1110",
                name: "Cash",
                balance: 10000,
                currency: "USD",
              },
              error: null,
            })
          ),
        })),
      })),
    })),
    rpc: vi.fn((funcName) => {
      if (funcName === "generate_journal_entry_number") {
        return Promise.resolve({ data: "2024000001", error: null });
      }
      if (funcName === "post_journal_entry") {
        return Promise.resolve({ data: 2, error: null });
      }
      if (funcName === "validate_journal_entry_balance") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  },
}));

describe("GeneralLedgerService", () => {
  let service: GeneralLedgerService;

  beforeEach(() => {
    service = new GeneralLedgerService();
    vi.clearAllMocks();
  });

  describe("createJournalEntry", () => {
    it("should create a balanced journal entry successfully", async () => {
      const input: CreateJournalEntryInput = {
        entry_date: "2024-01-01",
        description: "Test entry",
        reference: "TEST-001",
        ledger_entries: [
          {
            account_id: "account-1",
            debit: 1000,
            credit: 0,
            currency: "USD",
          },
          {
            account_id: "account-2",
            debit: 0,
            credit: 1000,
            currency: "USD",
          },
        ],
      };

      const result = await service.createJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.journal_entry).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should reject unbalanced journal entry", async () => {
      const input: CreateJournalEntryInput = {
        entry_date: "2024-01-01",
        description: "Unbalanced entry",
        ledger_entries: [
          {
            account_id: "account-1",
            debit: 1000,
            credit: 0,
            currency: "USD",
          },
          {
            account_id: "account-2",
            debit: 0,
            credit: 500, // Unbalanced!
            currency: "USD",
          },
        ],
      };

      const result = await service.createJournalEntry(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not balanced");
    });

    it("should validate that debits equal credits", async () => {
      const input: CreateJournalEntryInput = {
        entry_date: "2024-01-01",
        ledger_entries: [
          { account_id: "acc-1", debit: 100, credit: 0, currency: "USD" },
          { account_id: "acc-2", debit: 200, credit: 0, currency: "USD" },
          { account_id: "acc-3", debit: 0, credit: 300, currency: "USD" },
        ],
      };

      const result = await service.createJournalEntry(input);

      expect(result.success).toBe(true);
      
      // Verify balance
      const totalDebits = input.ledger_entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = input.ledger_entries.reduce((sum, e) => sum + e.credit, 0);
      expect(totalDebits).toBe(totalCredits);
    });

    it("should handle rounding differences within tolerance", async () => {
      const input: CreateJournalEntryInput = {
        entry_date: "2024-01-01",
        ledger_entries: [
          { account_id: "acc-1", debit: 100.005, credit: 0, currency: "USD" },
          { account_id: "acc-2", debit: 0, credit: 100.004, currency: "USD" },
        ],
      };

      const result = await service.createJournalEntry(input);

      // Should succeed because difference (0.001) is within tolerance (0.01)
      expect(result.success).toBe(true);
    });
  });

  describe("postTransaction", () => {
    it("should post a journal entry successfully", async () => {
      const result = await service.postTransaction(
        "test-journal-entry-id",
        "test-user-id"
      );

      expect(result.success).toBe(true);
      expect(result.journal_entry_id).toBe("test-journal-entry-id");
      expect(result.accounts_updated).toBe(2);
    });

    it("should handle posting errors gracefully", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Entry not found" } as any,
      });

      const result = await service.postTransaction(
        "invalid-id",
        "test-user-id"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getAccountBalance", () => {
    it("should return account balance within 100ms", async () => {
      const startTime = Date.now();
      
      const balance = await service.getAccountBalance("test-account-id");
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(balance).toBeDefined();
      expect(balance?.account_id).toBe("test-account-id");
      expect(duration).toBeLessThan(100); // Requirement 1.5
    });

    it("should cache balance results", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const fromSpy = vi.spyOn(supabase, "from");

      // First call - should hit database
      await service.getAccountBalance("test-account-id");
      const firstCallCount = fromSpy.mock.calls.length;

      // Second call - should use cache
      await service.getAccountBalance("test-account-id");
      const secondCallCount = fromSpy.mock.calls.length;

      // Should not make additional database calls
      expect(secondCallCount).toBe(firstCallCount);
    });

    it("should return null for non-existent account", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: null, error: { message: "Not found" } as any })
            ),
          })),
        })),
      } as any);

      const balance = await service.getAccountBalance("invalid-id");

      expect(balance).toBeNull();
    });
  });

  describe("getTrialBalance", () => {
    it("should generate trial balance for date range", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Mock accounts
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: [
                  { id: "acc-1", code: "1110", name: "Cash", type: "asset" },
                  { id: "acc-2", code: "4100", name: "Revenue", type: "revenue" },
                ],
                error: null,
              })
            ),
          })),
        })),
      } as any);

      // Mock ledger entries
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { account_id: "acc-1", debit: 1000, credit: 0 },
                    { account_id: "acc-2", debit: 0, credit: 1000 },
                  ],
                  error: null,
                })
              ),
            })),
          })),
        })),
      } as any);

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const trialBalance = await service.getTrialBalance(startDate, endDate);

      expect(trialBalance).toBeDefined();
      expect(trialBalance?.is_balanced).toBe(true);
      expect(trialBalance?.total_debits).toBe(trialBalance?.total_credits);
    });

    it("should detect unbalanced trial balance", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: [
                  { id: "acc-1", code: "1110", name: "Cash", type: "asset" },
                ],
                error: null,
              })
            ),
          })),
        })),
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { account_id: "acc-1", debit: 1000, credit: 500 }, // Unbalanced
                  ],
                  error: null,
                })
              ),
            })),
          })),
        })),
      } as any);

      const trialBalance = await service.getTrialBalance(
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(trialBalance?.is_balanced).toBe(false);
    });
  });

  describe("validateJournalEntryBalance", () => {
    it("should validate balanced journal entry", async () => {
      const isValid = await service.validateJournalEntryBalance(
        "test-journal-entry-id"
      );

      expect(isValid).toBe(true);
    });

    it("should return false for invalid entry", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: false,
        error: null,
      });

      const isValid = await service.validateJournalEntryBalance("invalid-id");

      expect(isValid).toBe(false);
    });
  });
});
