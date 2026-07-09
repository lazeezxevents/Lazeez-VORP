import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generalLedgerService } from "@/components/finance/GeneralLedgerService";
import { supabase } from "@/integrations/supabase/client";
import type {
  CreateJournalEntryInput,
  JournalEntryWithLines,
  Balance,
  TrialBalance,
} from "@/components/finance/types";

// =====================================================
// Query Keys
// =====================================================

const QUERY_KEYS = {
  journalEntries: ["finance", "journal-entries"] as const,
  journalEntry: (id: string) => ["finance", "journal-entries", id] as const,
  accountBalance: (accountId: string, date?: string) => 
    ["finance", "account-balance", accountId, date] as const,
  trialBalance: (startDate: string, endDate: string) => 
    ["finance", "trial-balance", startDate, endDate] as const,
};

// =====================================================
// Fetch Functions
// =====================================================

async function fetchJournalEntries(): Promise<JournalEntryWithLines[]> {
  const { data, error } = await supabase
    .from("finance_journal_entries")
    .select(`
      *,
      ledger_entries:finance_ledger_entries(*)
    `)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching journal entries:", error);
    throw new Error(`Failed to fetch journal entries: ${error.message}`);
  }

  return data as JournalEntryWithLines[];
}

async function fetchJournalEntry(id: string): Promise<JournalEntryWithLines> {
  const { data, error } = await supabase
    .from("finance_journal_entries")
    .select(`
      *,
      ledger_entries:finance_ledger_entries(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching journal entry:", error);
    throw new Error(`Failed to fetch journal entry: ${error.message}`);
  }

  return data as JournalEntryWithLines;
}

// =====================================================
// Main Hook
// =====================================================

export function useGeneralLedger() {
  const queryClient = useQueryClient();

  // Fetch all journal entries
  const journalEntriesQuery = useQuery({
    queryKey: QUERY_KEYS.journalEntries,
    queryFn: fetchJournalEntries,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create journal entry mutation
  const createJournalEntryMutation = useMutation({
    mutationFn: (input: CreateJournalEntryInput) =>
      generalLedgerService.createJournalEntry(input),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Journal entry created", {
          description: `Entry ${result.journal_entry?.entry_number} created successfully`,
        });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.journalEntries });
      } else {
        toast.error("Failed to create journal entry", {
          description: result.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to create journal entry", {
        description: error.message,
      });
    },
  });

  // Post journal entry mutation
  const postJournalEntryMutation = useMutation({
    mutationFn: async ({ journalEntryId, userId }: { journalEntryId: string; userId: string }) =>
      generalLedgerService.postTransaction(journalEntryId, userId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Journal entry posted", {
          description: `${result.accounts_updated} account(s) updated`,
        });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.journalEntries });
        queryClient.invalidateQueries({ queryKey: ["finance", "account-balance"] });
      } else {
        toast.error("Failed to post journal entry", {
          description: result.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to post journal entry", {
        description: error.message,
      });
    },
  });

  return {
    // Queries
    journalEntries: journalEntriesQuery.data || [],
    isLoading: journalEntriesQuery.isLoading,
    isError: journalEntriesQuery.isError,
    error: journalEntriesQuery.error,

    // Mutations
    createJournalEntry: createJournalEntryMutation.mutate,
    postJournalEntry: postJournalEntryMutation.mutate,
    isCreating: createJournalEntryMutation.isPending,
    isPosting: postJournalEntryMutation.isPending,
  };
}

// =====================================================
// Individual Journal Entry Hook
// =====================================================

export function useJournalEntry(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.journalEntry(id),
    queryFn: () => fetchJournalEntry(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// =====================================================
// Account Balance Hook
// =====================================================

export function useAccountBalance(accountId: string, date?: Date) {
  const dateStr = date?.toISOString().split('T')[0];
  
  return useQuery({
    queryKey: QUERY_KEYS.accountBalance(accountId, dateStr),
    queryFn: () => generalLedgerService.getAccountBalance(accountId, date),
    enabled: !!accountId,
    staleTime: 60 * 1000, // 1 minute (matches service cache)
  });
}

// =====================================================
// Trial Balance Hook
// =====================================================

export function useTrialBalance(startDate: Date, endDate: Date) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: QUERY_KEYS.trialBalance(startDateStr, endDateStr),
    queryFn: () => generalLedgerService.getTrialBalance(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
