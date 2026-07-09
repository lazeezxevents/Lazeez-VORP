/**
 * useCommunicationPermissions Hook
 * 
 * Provides role-based permission checks for communication features.
 * 
 * Requirements:
 * - 4.1: Integrate with VORP RBAC system
 * - 4.2: Display only assigned departments/channels
 * - 4.4: Admin can create departments
 * - 4.5: Admin can assign users to departments
 * - 4.6: Manager/Employee can create channels
 * - 4.7: Manager/Employee cannot create departments
 */

import { useAuth } from "@/components/contexts/AuthContext";

/** Any authenticated corporate user can use messaging; admins get full RBAC from hasPermission. */
export const useCommunicationPermissions = () => {
  const { user, hasPermission, isAdmin, isManager, isHR, role } = useAuth();

  const canUseMessaging =
    isAdmin ||
    isManager ||
    isHR ||
    role === "employee" ||
    role === "ops_manager";

  const permissions = {
    // Department permissions
    canCreateDepartment: hasPermission("admin"),
    canManageDepartments: hasPermission("admin"),
    canAssignUsersToDepartments: hasPermission("admin"),

    // Channel permissions
    canCreateChannel: isAdmin || canUseMessaging,
    canDeleteChannel: hasPermission("admin"),
    canArchiveChannel: hasPermission("admin"),
    canManageChannelMembers: (isChannelOwner: boolean) =>
      hasPermission("admin") || isChannelOwner,

    // Message permissions
    canSendMessage: canUseMessaging,
    canEditOwnMessage: canUseMessaging,
    canDeleteOwnMessage: canUseMessaging,
    canDeleteAnyMessage: hasPermission("admin"),

    // Call permissions
    canInitiateCall: canUseMessaging,
    canRecordCalls: hasPermission("admin") || isManager,

    // File permissions
    canUploadFiles: canUseMessaging,

    // Moderation permissions
    canPinMessages: (isChannelOwner: boolean) =>
      hasPermission("admin") || isChannelOwner,
    canManagePrivateChannels: hasPermission("admin"),

    // User info
    userId: user?.id || "",
    userRole: user?.user_metadata?.role || "employee",
    isAdmin,
    isManager,
    isStaff: isHR || isManager || role === "employee",
  };

  return permissions;
};
