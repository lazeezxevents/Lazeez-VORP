import { supabase } from "@/integrations/supabase/client";

interface CreateNotificationInput {
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: input.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        action_url: input.actionUrl,
        metadata: input.metadata || {},
      });

    if (error) {
      console.error("Failed to create notification:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("Notification creation error:", err);
    return { success: false, error: err };
  }
}

// Onboarding-specific notification helpers
export async function notifyUserApproved(userId: string) {
  return createNotification({
    userId,
    type: 'success',
    category: 'hr',
    title: 'Account Approved',
    message: 'Your account has been approved and you now have access to the system.',
    actionUrl: '/dashboard',
  });
}

export async function notifyDesignationAssigned(userId: string, designationName: string) {
  return createNotification({
    userId,
    type: 'info',
    category: 'hr',
    title: 'Role Assigned',
    message: `You have been assigned the role: ${designationName}`,
    actionUrl: '/settings',
  });
}

export async function notifyRolePromotion(userId: string, fromRole: string, toRole: string) {
  return createNotification({
    userId,
    type: 'success',
    category: 'hr',
    title: 'Role Promotion',
    message: `You have been promoted from ${fromRole} to ${toRole}`,
    actionUrl: '/dashboard',
  });
}