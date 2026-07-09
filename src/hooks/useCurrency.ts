import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrencies,
  getDefaultCurrency,
  setDefaultCurrency,
  getUserCurrencyPreference,
  setUserCurrencyPreference,
  convertCurrency,
  getCurrencyByCode,
  type Currency,
} from "@/components/finance/CurrencyService";
import { useAuth } from "@/contexts/AuthContext";

// =====================================================
// Query Keys
// =====================================================

const QUERY_KEYS = {
  currencies: ["currencies"] as const,
  defaultCurrency: ["currencies", "default"] as const,
  userPreference: (userId: string) => ["currencies", "user-preference", userId] as const,
};

// =====================================================
// Currency Queries
// =====================================================

/**
 * Hook to fetch all active currencies
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.currencies,
    queryFn: async () => {
      const result = await getCurrencies();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - currencies don't change often
  });
}

/**
 * Hook to fetch the default currency
 */
export function useDefaultCurrency() {
  return useQuery({
    queryKey: QUERY_KEYS.defaultCurrency,
    queryFn: async () => {
      const result = await getDefaultCurrency();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch user's currency preference
 */
export function useUserCurrency() {
  const { user } = useAuth();
  const { data: defaultCurrency } = useDefaultCurrency();

  const preferenceQuery = useQuery({
    queryKey: QUERY_KEYS.userPreference(user?.id || ""),
    queryFn: async () => {
      if (!user?.id) return null;
      const result = await getUserCurrencyPreference(user.id);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const currencyQuery = useQuery({
    queryKey: ["currencies", "user-currency", preferenceQuery.data?.currency_code || defaultCurrency?.code],
    queryFn: async () => {
      const code = preferenceQuery.data?.currency_code || defaultCurrency?.code;
      if (!code) return defaultCurrency;
      
      const result = await getCurrencyByCode(code);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data || defaultCurrency;
    },
    enabled: !!preferenceQuery.data?.currency_code || !!defaultCurrency?.code,
    staleTime: 5 * 60 * 1000,
  });

  return {
    currency: currencyQuery.data || defaultCurrency,
    preference: preferenceQuery.data,
    isLoading: preferenceQuery.isLoading || currencyQuery.isLoading,
    isError: preferenceQuery.isError || currencyQuery.isError,
  };
}

// =====================================================
// Currency Mutations
// =====================================================

/**
 * Hook to set the default currency (admin only)
 */
export function useSetDefaultCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currencyCode: string) => {
      const result = await setDefaultCurrency(currencyCode);
      if (!result.success) {
        throw new Error(result.error || "Failed to set default currency");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all currency-related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currencies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultCurrency });
    },
  });
}

/**
 * Hook to set user's currency preference
 */
export function useSetUserCurrency() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currencyCode: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      const result = await setUserCurrencyPreference(user.id, currencyCode);
      if (!result.success) {
        throw new Error(result.error || "Failed to set currency preference");
      }
      return result;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userPreference(user.id) });
      }
    },
  });
}

/**
 * Hook to convert currency amounts
 */
export function useCurrencyConverter() {
  return useMutation({
    mutationFn: async ({
      amount,
      from,
      to,
    }: {
      amount: number;
      from: string;
      to: string;
    }) => {
      const result = await convertCurrency(amount, from, to);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}

// =====================================================
// Utility Hooks
// =====================================================

/**
 * Hook to get currency by code
 */
export function useCurrencyByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["currencies", "by-code", code],
    queryFn: async () => {
      if (!code) return null;
      const result = await getCurrencyByCode(code);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });
}
