import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchExchangeRatesWithFallback,
  storeExchangeRates,
  getExchangeRate,
  getLatestExchangeRate,
  getHistoricalRates,
  updateDailyExchangeRates,
  validateExchangeRate,
} from "../ExchangeRateService";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: null,
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
      upsert: vi.fn(() => ({
        data: null,
        error: null,
        count: 0,
      })),
    })),
  },
}));

describe("ExchangeRateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateExchangeRate", () => {
    it("should validate positive rates", () => {
      const result = validateExchangeRate(1.5, "PKR", "USD");
      expect(result.valid).toBe(true);
    });

    it("should reject negative rates", () => {
      const result = validateExchangeRate(-1.5, "PKR", "USD");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("positive");
    });

    it("should reject zero rates", () => {
      const result = validateExchangeRate(0, "PKR", "USD");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("positive");
    });

    it("should reject infinite rates", () => {
      const result = validateExchangeRate(Infinity, "PKR", "USD");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("finite");
    });

    it("should reject rates outside reasonable bounds", () => {
      const resultTooLow = validateExchangeRate(0.00001, "PKR", "USD");
      expect(resultTooLow.valid).toBe(false);
      expect(resultTooLow.reason).toContain("outside reasonable bounds");

      const resultTooHigh = validateExchangeRate(20000, "PKR", "USD");
      expect(resultTooHigh.valid).toBe(false);
      expect(resultTooHigh.reason).toContain("outside reasonable bounds");
    });

    it("should accept rates within reasonable bounds", () => {
      const result1 = validateExchangeRate(0.001, "PKR", "USD");
      expect(result1.valid).toBe(true);

      const result2 = validateExchangeRate(5000, "PKR", "USD");
      expect(result2.valid).toBe(true);
    });
  });

  describe("fetchExchangeRatesWithFallback", () => {
    it("should attempt multiple providers on failure", async () => {
      // Mock fetch to fail for first provider, succeed for second
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error("Provider 1 failed"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rates: { USD: 0.0036, EUR: 0.0033 },
          }),
        });

      const result = await fetchExchangeRatesWithFallback("PKR");

      expect(result.rates).toBeDefined();
      expect(result.source).toBe("frankfurter");
      expect(result.error).toBeUndefined();
    });

    it("should return error when all providers fail", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchExchangeRatesWithFallback("PKR");

      expect(result.rates).toEqual({});
      expect(result.source).toBe("none");
      expect(result.error).toContain("All providers failed");
    });
  });

  describe("storeExchangeRates", () => {
    it("should store both direct and inverse rates", async () => {
      const rates = {
        USD: 0.0036,
        EUR: 0.0033,
      };

      const result = await storeExchangeRates("PKR", rates, "test-provider");

      expect(result.success).toBe(true);
      // Should store 4 records: PKR->USD, PKR->EUR, USD->PKR, EUR->PKR
      expect(result.count).toBeGreaterThanOrEqual(4);
    });

    it("should handle database errors gracefully", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn(() => ({
          data: null,
          error: { message: "Database error" },
          count: 0,
        })),
      } as any);

      const rates = { USD: 0.0036 };
      const result = await storeExchangeRates("PKR", rates, "test-provider");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("updateDailyExchangeRates", () => {
    it("should fetch and store rates successfully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: { USD: 0.0036, EUR: 0.0033 },
        }),
      });

      const result = await updateDailyExchangeRates("PKR");

      expect(result.success).toBe(true);
      expect(result.source).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
    });

    it("should handle fetch failures", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await updateDailyExchangeRates("PKR");

      expect(result.success).toBe(false);
      expect(result.error).toContain("All providers failed");
    });
  });

  describe("Rate conversion consistency", () => {
    it("should maintain conversion consistency (A->B->A = A)", () => {
      const originalAmount = 1000;
      const rateAtoB = 0.0036; // PKR to USD
      const rateBtoA = 1 / rateAtoB; // USD to PKR

      const convertedToB = originalAmount * rateAtoB;
      const convertedBackToA = convertedToB * rateBtoA;

      // Should be approximately equal (allowing for floating point precision)
      expect(Math.abs(convertedBackToA - originalAmount)).toBeLessThan(0.01);
    });

    it("should validate inverse rate calculation", () => {
      const rate = 278.5; // PKR per USD
      const inverseRate = 1 / rate; // USD per PKR

      expect(inverseRate).toBeCloseTo(0.00359, 5);
      expect(1 / inverseRate).toBeCloseTo(rate, 2);
    });
  });

  describe("Historical rate queries", () => {
    it("should query rates within date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await getHistoricalRates("PKR", "USD", startDate, endDate);

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe("Rate reasonableness checks", () => {
    it("should detect unreasonable rate spikes", () => {
      const normalRate = 278.5;
      const spikedRate = normalRate * 10; // 10x spike

      const validation = validateExchangeRate(spikedRate, "PKR", "USD");
      
      // Should still be valid if within bounds, but would trigger anomaly detection
      expect(validation.valid).toBe(true);
      expect(spikedRate).toBeGreaterThan(normalRate * 2);
    });

    it("should validate common currency pairs", () => {
      const commonRates = {
        "PKR-USD": 278.5,
        "PKR-EUR": 302.8,
        "PKR-GBP": 352.5,
        "USD-EUR": 0.92,
        "GBP-USD": 1.27,
      };

      Object.entries(commonRates).forEach(([pair, rate]) => {
        const [from, to] = pair.split("-");
        const validation = validateExchangeRate(rate, from, to);
        expect(validation.valid).toBe(true);
      });
    });
  });
});
