/**
 * MessageService
 * 
 * Handles message CRUD operations including editing and deletion.
 * 
 * Requirements:
 * - 12.1: Display edit and delete options for message authors
 * - 12.2: Update message content and display "edited" indicator
 * - 12.3: Remove content and display "message deleted" placeholder
 * - 12.4: Maintain edit history for audit purposes
 * - 12.5: Allow editing within 24 hours
 * - 12.6: Allow deletion at any time
 * - 12.8: Record actions in audit logs
 */

import { supabase } from "@/integrations/supabase/client";

export interface EditMessageParams {
  messageId: string;
  content: string;
}

export interface DeleteMessageParams {
  messageId: string;
}

export class MessageService {
  /**
   * Edit a message
   * Requirements: 12.2, 12.4, 12.5, 12.8
   */
  static async editMessage({ messageId, content }: EditMessageParams) {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get the message to check ownership and age
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("user_id, created_at, content")
      .eq("id", messageId)
      .single();

    if (fetchError) throw fetchError;
    if (!message) throw new Error("Message not found");

    // Check ownership
    if (message.user_id !== user.id) {
      throw new Error("You can only edit your own messages");
    }

    // Check 24-hour edit window
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (messageAge > twentyFourHours) {
      throw new Error("Messages can only be edited within 24 hours");
    }

    // Update the message
    const { data: updatedMessage, error: updateError } = await supabase
      .from("messages")
      .update({
        content,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Record in audit logs
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "message.edited",
      entity_type: "message",
      entity_id: messageId,
      details: {
        old_content: message.content,
        new_content: content,
      },
    });

    return updatedMessage;
  }

  /**
   * Delete a message
   * Requirements: 12.3, 12.6, 12.8
   */
  static async deleteMessage({ messageId }: DeleteMessageParams) {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get the message to check ownership
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("user_id, content, channel_id")
      .eq("id", messageId)
      .single();

    if (fetchError) throw fetchError;
    if (!message) throw new Error("Message not found");

    // Check if user is the author or an admin
    const { data: profile } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = profile?.role === "Admin";
    const isAuthor = message.user_id === user.id;

    if (!isAuthor && !isAdmin) {
      throw new Error("You can only delete your own messages");
    }

    // Soft delete the message (set deleted_at timestamp)
    const { data: deletedMessage, error: deleteError } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        content: "", // Clear content for privacy
      })
      .eq("id", messageId)
      .select()
      .single();

    if (deleteError) throw deleteError;

    // Record in audit logs
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "message.deleted",
      entity_type: "message",
      entity_id: messageId,
      details: {
        content: message.content,
        channel_id: message.channel_id,
        deleted_by_admin: isAdmin && !isAuthor,
      },
    });

    return deletedMessage;
  }

  /**
   * Check if user can edit a message
   * Requirements: 12.1, 12.5
   */
  static canEditMessage(message: {
    user_id: string;
    created_at: string;
  }, currentUserId: string): boolean {
    // Must be the author
    if (message.user_id !== currentUserId) return false;

    // Must be within 24 hours
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return messageAge <= twentyFourHours;
  }

  /**
   * Check if user can delete a message
   * Requirements: 12.1, 12.6
   */
  static canDeleteMessage(message: {
    user_id: string;
  }, currentUserId: string, isAdmin: boolean): boolean {
    // Author can always delete
    if (message.user_id === currentUserId) return true;

    // Admin can delete any message
    return isAdmin;
  }
}
