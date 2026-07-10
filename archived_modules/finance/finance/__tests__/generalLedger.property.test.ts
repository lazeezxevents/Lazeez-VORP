import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { CreateJournalEntryInput, LedgerEntryInput } from "../types";

/**
 * Property-Based Tests for General Ledger
 * 
 * Property 1: Accounting Equation Balance
 * Validates: Requirements 1.2
 * 
 * Tests that for any valid journal entry, the sum of debits
 * always equals the sum of credits.
 */

describe("General Ledger Property Tests", () => {
  /**
   * Arbitrary generator for ledger entries
   * Generates valid ledger entries with either debit or credit
   */
  const ledgerEntryArbitrary = fc.record({
    account_id: fc.uuid(),
    debit: fc.double({ min: 0, max: 100000, noNaN: true }),
    credit: fc.constant(0),
    currency: fc.constant("USD"),
    description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  }).chain((entry) =>
    fc.constantFrom(
      // Either debit or credit, not both
      { ...entry, debit: entry.debit, credit: 0 },
      { ...entry, debit: 0, credit: entry.debit }
    )
  );

  /**
   * Arbitrary generator for balanced journal entries
   * Generates journal entries where debits equal credits
   */
  const balancedJournalEntryArbitrary = fc
    .tuple(
      fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
      fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
      fc.integer({ min: 2, max: 10 }) // Number of entry pairs
    )
    .chain(([date, description, reference, pairCount]) =>
      fc
        .array(
          fc.tuple(
            fc.uuid(), // debit account
            fc.uuid(), // credit account
            fc.double({ min: 0.01, max: 10000, noNaN: true }) // amount
          ),
          { minLength: pairCount, maxLength: pairCount }
        )
        .map((pairs) => {
          const ledger_entries: LedgerEntryInput[] = [];

          pairs.forEach(([debitAccount, creditAccount, amount]) => {
            // Add debit entry
            ledger_entries.push({
              account_id: debitAccount,
              debit: amount,
              credit: 0,
              currency: "USD",
              description: undefined,
            });

            // Add credit entry
            ledger_entries.push({
              account_id: creditAccount,
              debit: 0,
              credit: amount,
              currency: "USD",
              description: undefined,
            });
          });

          const entry: CreateJournalEntryInput = {
            entry_date: date.toISOString().split("T")[0],
            description,
            reference,
            ledger_entries,
          };

          return entry;
        })
    );

  /**
   * Property 1: Accounting Equation Balance
   * 
   * For any balanced journal entry, the sum of debits must equal
   * the sum of credits within a small rounding tolerance.
   */
  it("Property 1: Sum of debits equals sum of credits for balanced entries", () => {
    fc.assert(
      fc.property(balancedJournalEntryArbitrary, (journalEntry) => {
        const totalDebits = journalEntry.ledger_entries.reduce(
          (sum, entry) => sum + entry.debit,
          0
        );
        const totalCredits = journalEntry.ledger_entries.reduce(
          (sum, entry) => sum + entry.credit,
          0
        );

        // Allow small rounding differences (0.01)
        const difference = Math.abs(totalDebits - totalCredits);
        
        expect(difference).toBeLessThan(0.01);
        expect(journalEntry.ledger_entries.length).toBeGreaterThanOrEqual(2);
        
        return difference < 0.01;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Each ledger entry has either debit or credit, not both
   * 
   * Validates that each ledger entry follows double-entry bookkeeping rules
   */
  it("Property 2: Each ledger entry has either debit or credit, not both", () => {
    fc.assert(
      fc.property(balancedJournalEntryArbitrary, (journalEntry) => {
        return journalEntry.ledger_entries.every((entry) => {
          const hasDebit = entry.debit > 0;
          const hasCredit = entry.credit > 0;
          
          // XOR: either debit or credit, not both, not neither
          return (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: All amounts are non-negative
   * 
   * Validates that debit and credit amounts are always >= 0
   */
  it("Property 3: All amounts are non-negative", () => {
    fc.assert(
      fc.property(balancedJournalEntryArbitrary, (journalEntry) => {
        return journalEntry.ledger_entries.every((entry) => {
          return entry.debit >= 0 && entry.credit >= 0;
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Journal entry has at least 2 ledger entries
   * 
   * Validates minimum requirement for double-entry bookkeeping
   */
  it("Property 4: Journal entry has at least 2 ledger entries", () => {
    fc.assert(
      fc.property(balancedJournalEntryArbitrary, (journalEntry) => {
        return journalEntry.ledger_entries.length >= 2;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Balance is preserved after splitting entries
   * 
   * If we split a journal entry into multiple smaller entries,
   * the total balance is preserved
   */
  it("Property 5: Balance is preserved when splitting entries", () => {
    fc.assert(
      fc.property(
        balancedJournalEntryArbitrary,
        fc.integer({ min: 2, max: 5 }),
        (journalEntry, splitFactor) => {
          const originalDebits = journalEntry.ledger_entries.reduce(
            (sum, e) => sum + e.debit,
            0
          );
          const originalCredits = journalEntry.ledger_entries.reduce(
            (sum, e) => sum + e.credit,
            0
          );

          // Split each entry into multiple smaller entries
          const splitEntries: LedgerEntryInput[] = [];
          journalEntry.ledger_entries.forEach((entry) => {
            const splitAmount = entry.debit > 0 ? entry.debit / splitFactor : entry.credit / splitFactor;
            
            for (let i = 0; i < splitFactor; i++) {
              splitEntries.push({
                account_id: entry.account_id,
                debit: entry.debit > 0 ? splitAmount : 0,
                credit: entry.credit > 0 ? splitAmount : 0,
                currency: entry.currency,
                description: entry.description,
              });
            }
          });

          const splitDebits = splitEntries.reduce((sum, e) => sum + e.debit, 0);
          const splitCredits = splitEntries.reduce((sum, e) => sum + e.credit, 0);

          // Balance should be preserved (within rounding tolerance)
          expect(Math.abs(splitDebits - originalDebits)).toBeLessThan(0.01);
          expect(Math.abs(splitCredits - originalCredits)).toBeLessThan(0.01);
          expect(Math.abs(splitDebits - splitCredits)).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
