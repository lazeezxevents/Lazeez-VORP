import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Enhanced Audit Log with User Profile
 */
export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
  // Enhanced fields from profile join
  user_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    main_role: string;
  } | null;
}

interface UseAuditLogsParams {
  userId?: string;
  userIds?: string[];
  limit?: number;
}

export function useAuditLogs(params: UseAuditLogsParams = {}) {
  const { userId, userIds, limit = 200 } = params;

  return useQuery({
    queryKey: ["audit-logs", "with-profiles", userId, userIds, limit],
    queryFn: async () => {
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
          `
          )
          .order("created_at", { ascending: false })
          .limit(limit);

        // Filter by single user
        if (userId) {
          query = query.eq("user_id", userId);
        }
        // Filter by multiple users
        else if (userIds && userIds.length > 0) {
          query = query.in("user_id", userIds);
        }

        const { data, error } = await query;

        if (error) {
          // If foreign key doesn't exist, fall back to query without profiles
          console.warn("Error fetching audit logs with profiles, falling back:", error);
          
          let fallbackQuery = supabase
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);

          if (userId) {
            fallbackQuery = fallbackQuery.eq("user_id", userId);
          } else if (userIds && userIds.length > 0) {
            fallbackQuery = fallbackQuery.in("user_id", userIds);
          }

          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          
          if (fallbackError) {
            throw fallbackError;
          }

          return (fallbackData || []) as AuditLog[];
        }

        // Transform the data to flatten user_profile
        return (data || []).map((log: any) => ({
          ...log,
          user_profile: Array.isArray(log.user_profile)
            ? log.user_profile[0] || null
            : log.user_profile || null,
        })) as AuditLog[];
      } catch (error) {
        console.error("Error in useAuditLogs:", error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 1, // Only retry once
  });
}

/**
 * Get user initials for avatar fallback
 */
export function getUserInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: string): string {
  switch (role.toLowerCase()) {
    case "admin":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "staff":
    case "hr":
      return "bg-info/10 text-info border-info/20";
    case "manager":
      return "bg-warning/10 text-warning border-warning/20";
    case "employee":
      return "bg-success/10 text-success border-success/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Re-export the type for convenience
export type { AuditLog };
