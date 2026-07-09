/**
 * Communication Audit Service
 * 
 * Integrates communication events with VORP audit log system.
 * 
 * Requirements:
 * - 18.1: Integrate with VORP audit log bridge
 * - 18.2: Log message sent/edited/deleted events
 * - 18.3: Log channel created/archived events
 * - 18.4: Log user joined/left channel events
 * - 18.5: Log file upload events
 * - 18.6: Log call start/end events
 * - 18.7: Include user ID, timestamp, action type, entity details
 */

import { supabase } from "@/integrations/supabase/client";

export type CommunicationAuditAction =
  | "message_sent"
  | "message_edited"
  | "message_deleted"
  | "channel_created"
  | "channel_archived"
  | "channel_unarchived"
  | "user_joined_channel"
  | "user_left_channel"
  | "file_uploaded"
  | "call_started"
  | "call_ended"
  | "reaction_added"
  | "reaction_removed"
  | "message_pinned"
  | "message_unpinned";

interface AuditLogEntry {
  user_id: string;
  action: CommunicationAuditAction;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  ip_address?: string;
}

export class CommunicationAuditService {
  /**
   * Record a communication audit event
   */
  static async recordEvent(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from("audit_logs").insert({
        user_id: entry.user_id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        details: entry.details,
        ip_address: entry.ip_address,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to record audit event:", error);
      }
    } catch (error) {
      console.error("Audit logging error:", error);
    }
  }

  /**
   * Log message sent event
   */
  static async logMessageSent(
    userId: string,
    messageId: string,
    channelId: string,
    content: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "message_sent",
      entity_type: "message",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        content_length: content.length,
        has_mentions: content.includes("@"),
      },
    });
  }

  /**
   * Log message edited event
   */
  static async logMessageEdited(
    userId: string,
    messageId: string,
    channelId: string,
    originalContent: string,
    newContent: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "message_edited",
      entity_type: "message",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        original_content: originalContent,
        new_content: newContent,
        edited_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log message deleted event
   */
  static async logMessageDeleted(
    userId: string,
    messageId: string,
    channelId: string,
    content: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "message_deleted",
      entity_type: "message",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        deleted_content: content,
        deleted_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log channel created event
   */
  static async logChannelCreated(
    userId: string,
    channelId: string,
    channelName: string,
    departmentId: string,
    isPrivate: boolean
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "channel_created",
      entity_type: "channel",
      entity_id: channelId,
      details: {
        channel_name: channelName,
        department_id: departmentId,
        is_private: isPrivate,
      },
    });
  }

  /**
   * Log channel archived event
   */
  static async logChannelArchived(
    userId: string,
    channelId: string,
    channelName: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "channel_archived",
      entity_type: "channel",
      entity_id: channelId,
      details: {
        channel_name: channelName,
        archived_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log user joined channel event
   */
  static async logUserJoinedChannel(
    userId: string,
    channelId: string,
    channelName: string,
    addedBy?: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "user_joined_channel",
      entity_type: "channel_member",
      entity_id: channelId,
      details: {
        channel_name: channelName,
        added_by: addedBy,
        joined_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log user left channel event
   */
  static async logUserLeftChannel(
    userId: string,
    channelId: string,
    channelName: string,
    removedBy?: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "user_left_channel",
      entity_type: "channel_member",
      entity_id: channelId,
      details: {
        channel_name: channelName,
        removed_by: removedBy,
        left_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log file upload event
   */
  static async logFileUploaded(
    userId: string,
    messageId: string,
    channelId: string,
    fileName: string,
    fileSize: number,
    fileType: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "file_uploaded",
      entity_type: "message_attachment",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        uploaded_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log call started event
   */
  static async logCallStarted(
    userId: string,
    callId: string,
    channelId: string,
    callType: "voice" | "video"
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "call_started",
      entity_type: "call_session",
      entity_id: callId,
      details: {
        channel_id: channelId,
        call_type: callType,
        started_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log call ended event
   */
  static async logCallEnded(
    userId: string,
    callId: string,
    channelId: string,
    duration: number,
    participantCount: number
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "call_ended",
      entity_type: "call_session",
      entity_id: callId,
      details: {
        channel_id: channelId,
        duration_seconds: duration,
        participant_count: participantCount,
        ended_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Log reaction added event
   */
  static async logReactionAdded(
    userId: string,
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "reaction_added",
      entity_type: "message_reaction",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        emoji,
      },
    });
  }

  /**
   * Log message pinned event
   */
  static async logMessagePinned(
    userId: string,
    messageId: string,
    channelId: string
  ): Promise<void> {
    await this.recordEvent({
      user_id: userId,
      action: "message_pinned",
      entity_type: "pinned_message",
      entity_id: messageId,
      details: {
        channel_id: channelId,
        pinned_at: new Date().toISOString(),
      },
    });
  }
}
