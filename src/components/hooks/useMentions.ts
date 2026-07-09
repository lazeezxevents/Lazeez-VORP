/**
 * useMentions Hook
 * 
 * Manages @ mention detection, autocomplete, and insertion.
 * 
 * Requirements:
 * - 6.1: Trigger autocomplete on @ symbol
 * - 6.2: Filter members by name
 * - 6.3: Send notifications to mentioned users
 * - 6.5: Add to mentions inbox
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ChannelMember {
  id: string;
  full_name: string;
  profile_picture_url?: string | null;
  role: string;
  designation: string;
  status?: "online" | "away" | "dnd" | "offline";
}

interface MentionState {
  isOpen: boolean;
  searchQuery: string;
  position: { top: number; left: number };
  cursorPosition: number;
}

export const useMentions = (channelId?: string) => {
  const [mentionState, setMentionState] = useState<MentionState>({
    isOpen: false,
    searchQuery: "",
    position: { top: 0, left: 0 },
    cursorPosition: 0,
  });

  // Fetch channel members
  const { data: members = [] } = useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data, error } = await supabase
        .from("channel_members")
        .select(
          `
          user_id,
          profiles:user_id (
            id,
            full_name,
            profile_picture_url,
            main_role,
            designation
          ),
          user_presence:user_id (
            status
          )
        `
        )
        .eq("channel_id", channelId);

      if (error) throw error;

      return data.map((member: any) => ({
        id: member.profiles.id,
        full_name: member.profiles.full_name,
        profile_picture_url: member.profiles.profile_picture_url,
        role: member.profiles.main_role,
        designation: member.profiles.designation || "",
        status: member.user_presence?.status || "offline",
      })) as ChannelMember[];
    },
    enabled: !!channelId,
  });

  // Detect @ symbol and trigger autocomplete
  const handleInputChange = useCallback(
    (
      value: string,
      cursorPosition: number,
      textareaElement: HTMLTextAreaElement
    ) => {
      // Find the last @ before cursor
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        // Check if @ is at start or preceded by whitespace
        const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
        const isValidTrigger =
          lastAtIndex === 0 || /\s/.test(charBeforeAt || "");

        if (isValidTrigger) {
          // Extract search query after @
          const searchQuery = textBeforeCursor.substring(lastAtIndex + 1);

          // Check if there's a space after @ (which closes autocomplete)
          if (!searchQuery.includes(" ")) {
            // Calculate position for autocomplete dropdown
            const rect = textareaElement.getBoundingClientRect();
            const lineHeight = parseInt(
              window.getComputedStyle(textareaElement).lineHeight
            );

            setMentionState({
              isOpen: true,
              searchQuery,
              position: {
                top: rect.top - 280, // Position above textarea
                left: rect.left,
              },
              cursorPosition: lastAtIndex,
            });
            return;
          }
        }
      }

      // Close autocomplete if no valid @ found
      setMentionState((prev) => ({ ...prev, isOpen: false }));
    },
    []
  );

  // Insert mention into text
  const insertMention = useCallback(
    (
      currentValue: string,
      member: ChannelMember,
      onValueChange: (value: string) => void
    ) => {
      const beforeMention = currentValue.substring(
        0,
        mentionState.cursorPosition
      );
      const afterMention = currentValue.substring(
        mentionState.cursorPosition +
          mentionState.searchQuery.length +
          1 // +1 for @
      );

      // Insert mention with special formatting
      const mentionText =
        member.role === "special"
          ? `@${member.full_name} `
          : `@${member.full_name} `;

      const newValue = beforeMention + mentionText + afterMention;
      onValueChange(newValue);

      // Close autocomplete
      setMentionState((prev) => ({ ...prev, isOpen: false }));
    },
    [mentionState]
  );

  // Close autocomplete
  const closeMentionAutocomplete = useCallback(() => {
    setMentionState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Extract mentions from message content
  const extractMentions = useCallback((content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }, []);

  // Send notifications to mentioned users
  const sendMentionNotifications = useCallback(
    async (
      messageId: string,
      channelId: string,
      content: string,
      senderName: string
    ) => {
      const mentions = extractMentions(content);
      if (mentions.length === 0) return;

      // Handle special mentions
      if (mentions.includes("channel") || mentions.includes("here")) {
        // Get all channel members
        const { data: channelMembers } = await supabase
          .from("channel_members")
          .select("user_id")
          .eq("channel_id", channelId);

        if (!channelMembers) return;

        let targetUsers = channelMembers.map((m) => m.user_id);

        // Filter for @here (only active users)
        if (mentions.includes("here") && !mentions.includes("channel")) {
          const { data: activeUsers } = await supabase
            .from("user_presence")
            .select("user_id")
            .eq("status", "online");

          if (activeUsers) {
            const activeUserIds = new Set(activeUsers.map((u) => u.user_id));
            targetUsers = targetUsers.filter((id) => activeUserIds.has(id));
          }
        }

        // Send notifications
        const {
          data: { user },
        } = await supabase.auth.getUser();

        await supabase.from("notifications").insert(
          targetUsers
            .filter((userId) => userId !== user?.id) // Don't notify sender
            .map((userId) => ({
              user_id: userId,
              type: "mention",
              title: "You were mentioned",
              message: `${senderName} mentioned ${
                mentions.includes("channel") ? "@channel" : "@here"
              } in a message`,
              link: `/communication?channel=${channelId}&message=${messageId}`,
              metadata: {
                channel_id: channelId,
                message_id: messageId,
                mention_type: mentions.includes("channel")
                  ? "channel"
                  : "here",
              },
            }))
        );
      }

      // Handle individual mentions
      const individualMentions = mentions.filter(
        (m) => m !== "channel" && m !== "here"
      );

      if (individualMentions.length > 0) {
        // Find users by name
        const { data: mentionedUsers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("full_name", individualMentions);

        if (!mentionedUsers) return;

        const {
          data: { user },
        } = await supabase.auth.getUser();

        await supabase.from("notifications").insert(
          mentionedUsers
            .filter((u) => u.id !== user?.id) // Don't notify sender
            .map((mentionedUser) => ({
              user_id: mentionedUser.id,
              type: "mention",
              title: "You were mentioned",
              message: `${senderName} mentioned you in a message`,
              link: `/communication?channel=${channelId}&message=${messageId}`,
              metadata: {
                channel_id: channelId,
                message_id: messageId,
                mention_type: "individual",
              },
            }))
        );
      }
    },
    [extractMentions]
  );

  return {
    mentionState,
    members,
    handleInputChange,
    insertMention,
    closeMentionAutocomplete,
    extractMentions,
    sendMentionNotifications,
  };
};
