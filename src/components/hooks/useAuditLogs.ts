import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =====================================================
// Types
// =====================================================

export interface AuditLogFilter {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface AuditLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  user_id: string | null;
  created_at: string;
  ip_address?: string;
}

// Re-export types for convenience
export type { AuditLogFilter, AuditLogRecord };

// Enhanced audit log with user profile
export interface AuditLog extends AuditLogRecord {
  user_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    main_role: string;
  } | null;
}

// =====================================================
// Query Keys
// =====================================================

const QUERY_KEYS = {
  auditLogs: (filter: AuditLogFilter, limit: number, offset: number, financeOnly: boolean) => 
    ["finance", "audit-logs", filter, limit, offset, financeOnly] as const,
};

// =====================================================
// Enhanced Query Function
// =====================================================

async function queryAuditLogsWithProfiles(
  filter: AuditLogFilter = {},
  limit: number = 100,
  offset: number = 0,
  financeOnly: boolean = false
): Promise<{ data: AuditLog[]; count: number }> {
  try {
    let query = supabase
      .from("audit_logs")
      .select(
        `
        *,
        user_profile:profiles!audit_logs_user_id_fkey (
          id,
          full_name,
          email,
          avatar_url,
          main_role
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply finance-only filter if requested
    if (financeOnly && !filter.entity_type) {
      query = query.in("entity_type", [
        "account",
        "journal_entry",
        "vendor_financial_profile",
        "commission_rule",
        "financial_transaction",
        "invoice",
        "payment",
        "revenue",
        "expense",
        "subscription",
        "payout",
        "rider_payout",
        "delivery_payout",
      ]);
    } else if (filter.entity_type) {
      query = query.eq("entity_type", filter.entity_type);
    }

    if (filter.entity_id) {
      query = query.eq("entity_id", filter.entity_id);
    }

    if (filter.user_id) {
      query = query.eq("user_id", filter.user_id);
    }

    if (filter.start_date) {
      query = query.gte("created_at", filter.start_date.toISOString());
    }

    if (filter.end_date) {
      query = query.lte("created_at", filter.end_date.toISOString());
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // If foreign key doesn't exist, fall back to query without profiles
      console.warn("Error fetching audit logs with profiles, falling back:", error);
      
      let fallbackQuery = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Reapply filters
      if (financeOnly && !filter.entity_type) {
        fallbackQuery = fallbackQuery.in("entity_type", [
          "account",
          "journal_entry",
          "vendor_financial_profile",
          "commission_rule",
          "financial_transaction",
          "invoice",
          "payment",
          "revenue",
          "expense",
          "subscription",
          "payout",
          "rider_payout",
          "delivery_payout",
        ]);
      } else if (filter.entity_type) {
        fallbackQuery = fallbackQuery.eq("entity_type", filter.entity_type);
      }

      if (filter.entity_id) {
        fallbackQuery = fallbackQuery.eq("entity_id", filter.entity_id);
      }

      if (filter.user_id) {
        fallbackQuery = fallbackQuery.eq("user_id", filter.user_id);
      }

      if (filter.start_date) {
        fallbackQuery = fallbackQuery.gte("created_at", filter.start_date.toISOString());
      }

      if (filter.end_date) {
        fallbackQuery = fallbackQuery.lte("created_at", filter.end_date.toISOString());
      }

      fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);

      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery;
      
      if (fallbackError) {
        throw fallbackError;
      }

      return { data: (fallbackData || []) as AuditLog[], count: fallbackCount || 0 };
    }

    // Transform the data to flatten user_profile
    const transformedData = (data || []).map((log: any) => ({
      ...log,
      user_profile: Array.isArray(log.user_profile)
        ? log.user_profile[0] || null
        : log.user_profile || null,
    }));

    return { data: transformedData as AuditLog[], count: count || 0 };
  } catch (error) {
    console.error("Unexpected error querying audit logs:", error);
    throw error;
  }
}

// =====================================================
// Main Hook
// =====================================================

export function useAuditLogs(
  filter: AuditLogFilter = {},
  limit: number = 100,
  offset: number = 0,
  financeOnly: boolean = false
) {
  const auditLogsQuery = useQuery({
    queryKey: QUERY_KEYS.auditLogs(filter, limit, offset, financeOnly),
    queryFn: () => queryAuditLogsWithProfiles(filter, limit, offset, financeOnly),
    staleTime: 30 * 1000, // 30 seconds - audit logs are relatively static
  });

  return {
    auditLogs: auditLogsQuery.data?.data || [],
    totalCount: auditLogsQuery.data?.count || 0,
    isLoading: auditLogsQuery.isLoading,
    isError: auditLogsQuery.isError,
    error: auditLogsQuery.error,
  };
}

// =====================================================
// Export Hook
// =====================================================

export async function useExportAuditLogs(filter: AuditLogFilter): Promise<void> {
  const { exportAuditLogs } = await import("@/components/finance/AuditLogService");
  const result = await exportAuditLogs(filter);
  
  if (result.success && result.csv) {
    // Create download link
    const blob = new Blob([result.csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } else {
    throw new Error(result.error || 'Failed to export audit logs');
  }
}
