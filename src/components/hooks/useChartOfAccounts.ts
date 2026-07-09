import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { auditLogService } from "@/components/finance/AuditLogService";
import type { 
  Account, 
  CreateAccountInput, 
  UpdateAccountInput,
  AccountTreeNode,
  ChartOfAccounts 
} from "@/components/finance/types";

// =====================================================
// Query Keys
// =====================================================

const QUERY_KEYS = {
  accounts: ["finance", "accounts"] as const,
  accountById: (id: string) => ["finance", "accounts", id] as const,
  accountTree: ["finance", "accounts", "tree"] as const,
};

// =====================================================
// Helper Functions
// =====================================================

/**
 * Build hierarchical tree structure from flat account list
 */
function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const accountMap = new Map<string, AccountTreeNode>();
  const rootAccounts: AccountTreeNode[] = [];

  // First pass: Create tree nodes
  accounts.forEach(account => {
    accountMap.set(account.id, {
      ...account,
      children: [],
      level: 0,
      hasChildren: false,
    });
  });

  // Second pass: Build parent-child relationships
  accounts.forEach(account => {
    const node = accountMap.get(account.id)!;
    
    if (account.parent_account_id) {
      const parent = accountMap.get(account.parent_account_id);
      if (parent) {
        parent.children.push(node);
        parent.hasChildren = true;
        node.level = parent.level + 1;
      } else {
        // Parent not found, treat as root
        rootAccounts.push(node);
      }
    } else {
      rootAccounts.push(node);
    }
  });

  // Sort children by code
  const sortChildren = (nodes: AccountTreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootAccounts);
  return rootAccounts;
}

/**
 * Group accounts by type
 */
function groupAccountsByType(accounts: Account[]): ChartOfAccounts {
  const accountsByType = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  return {
    accounts,
    totalAccounts: accounts.length,
    accountsByType: accountsByType as ChartOfAccounts['accountsByType'],
  };
}

// =====================================================
// Fetch Functions
// =====================================================

async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    console.error("Error fetching accounts:", error);
    throw new Error(`Failed to fetch accounts: ${error.message}`);
  }

  return data || [];
}

async function fetchAccountById(id: string): Promise<Account> {
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching account:", error);
    throw new Error(`Failed to fetch account: ${error.message}`);
  }

  return data;
}

async function createAccount(input: CreateAccountInput): Promise<Account> {
  const { data, error } = await supabase
    .from("finance_accounts")
    .insert({
      code: input.code,
      name: input.name,
      type: input.type,
      sub_type: input.sub_type || null,
      currency: input.currency || 'PKR',
      parent_account_id: input.parent_account_id || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating account:", error);
    throw new Error(`Failed to create account: ${error.message}`);
  }

  // Log audit entry for account creation
  await auditLogService.logAuditEntry({
    entityType: 'account',
    entityId: data.id,
    action: 'create',
    oldValues: null,
    newValues: {
      code: data.code,
      name: data.name,
      type: data.type,
      sub_type: data.sub_type,
      currency: data.currency,
      is_active: data.is_active,
    },
  });

  return data;
}

async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  // Fetch old values before update
  const { data: oldAccount } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("finance_accounts")
    .update({
      name: input.name,
      sub_type: input.sub_type,
      parent_account_id: input.parent_account_id,
      is_active: input.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating account:", error);
    throw new Error(`Failed to update account: ${error.message}`);
  }

  // Log audit entry for account update
  if (oldAccount) {
    await auditLogService.logAuditEntry({
      entityType: 'account',
      entityId: id,
      action: 'update',
      oldValues: {
        name: oldAccount.name,
        sub_type: oldAccount.sub_type,
        parent_account_id: oldAccount.parent_account_id,
        is_active: oldAccount.is_active,
      },
      newValues: {
        name: data.name,
        sub_type: data.sub_type,
        parent_account_id: data.parent_account_id,
        is_active: data.is_active,
      },
    });
  }

  return data;
}

async function deleteAccount(id: string): Promise<void> {
  // Fetch account details before deletion for audit log
  const { data: account } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("finance_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting account:", error);
    throw new Error(`Failed to delete account: ${error.message}`);
  }

  // Log audit entry for account deletion
  if (account) {
    await auditLogService.logAuditEntry({
      entityType: 'account',
      entityId: id,
      action: 'delete',
      oldValues: {
        code: account.code,
        name: account.name,
        type: account.type,
        balance: account.balance,
      },
      newValues: null,
    });
  }
}

// =====================================================
// Main Hook
// =====================================================

export function useChartOfAccounts() {
  const queryClient = useQueryClient();

  // Fetch all accounts
  const accountsQuery = useQuery({
    queryKey: QUERY_KEYS.accounts,
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build account tree
  const accountTree = useQuery({
    queryKey: QUERY_KEYS.accountTree,
    queryFn: async () => {
      const accounts = await fetchAccounts();
      return buildAccountTree(accounts);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Group accounts by type
  const chartOfAccounts = useQuery({
    queryKey: [...QUERY_KEYS.accounts, "grouped"],
    queryFn: async () => {
      const accounts = await fetchAccounts();
      return groupAccountsByType(accounts);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create account mutation
  const createMutation = useMutation({
    mutationFn: createAccount,
    onMutate: async (newAccount) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.accounts });

      // Snapshot previous value
      const previousAccounts = queryClient.getQueryData<Account[]>(QUERY_KEYS.accounts);

      // Optimistically update
      if (previousAccounts) {
        const optimisticAccount: Account = {
          id: `temp-${Date.now()}`,
          code: newAccount.code,
          name: newAccount.name,
          type: newAccount.type,
          sub_type: newAccount.sub_type || null,
          currency: newAccount.currency || 'PKR',
          balance: 0,
          parent_account_id: newAccount.parent_account_id || null,
          is_active: newAccount.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Account[]>(
          QUERY_KEYS.accounts,
          [...previousAccounts, optimisticAccount]
        );
      }

      return { previousAccounts };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.accounts, context.previousAccounts);
      }
      toast.error("Failed to create account", {
        description: error.message,
      });
    },
    onSuccess: (data) => {
      toast.success("Account created successfully", {
        description: `${data.code} - ${data.name}`,
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
    },
  });

  // Update account mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      updateAccount(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.accounts });

      const previousAccounts = queryClient.getQueryData<Account[]>(QUERY_KEYS.accounts);

      if (previousAccounts) {
        queryClient.setQueryData<Account[]>(
          QUERY_KEYS.accounts,
          previousAccounts.map(account =>
            account.id === id
              ? { ...account, ...input, updated_at: new Date().toISOString() }
              : account
          )
        );
      }

      return { previousAccounts };
    },
    onError: (error, _variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.accounts, context.previousAccounts);
      }
      toast.error("Failed to update account", {
        description: error.message,
      });
    },
    onSuccess: (data) => {
      toast.success("Account updated successfully", {
        description: `${data.code} - ${data.name}`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
    },
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.accounts });

      const previousAccounts = queryClient.getQueryData<Account[]>(QUERY_KEYS.accounts);

      if (previousAccounts) {
        queryClient.setQueryData<Account[]>(
          QUERY_KEYS.accounts,
          previousAccounts.filter(account => account.id !== id)
        );
      }

      return { previousAccounts };
    },
    onError: (error, _variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.accounts, context.previousAccounts);
      }
      toast.error("Failed to delete account", {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success("Account deleted successfully");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
    },
  });

  return {
    // Queries
    accounts: accountsQuery.data || [],
    accountTree: accountTree.data || [],
    chartOfAccounts: chartOfAccounts.data,
    isLoading: accountsQuery.isLoading || accountTree.isLoading,
    isError: accountsQuery.isError || accountTree.isError,
    error: accountsQuery.error || accountTree.error,

    // Mutations
    createAccount: createMutation.mutate,
    // async variant useful for awaiting creation in UI flows
    createAccountAsync: createMutation.mutateAsync,
    updateAccount: updateMutation.mutate,
    deleteAccount: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// =====================================================
// Individual Account Hook
// =====================================================

export function useAccount(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.accountById(id),
    queryFn: () => fetchAccountById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
