/**
 * useSendMessage Hook
 * 
 * Provides message sending functionality with optimistic updates,
 * WebSocket integration, and offline message queueing.
 * 
 * Requirements:
 * - 1.1: Deliver messages within 200ms
 * - 1.2: Display new messages immediately without page refresh
 * - 1.5: Queue messages when offline and send upon reconnection
 * - 1.7: Display delivery confirmation indicator
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WebSocketClient, MessageType } from "@/lib/websocket/client";
import { toast } from "sonner";

interface Message {
  id: string;
  channel_id: string;
  thread_parent_id?: string | null;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachments?: any[];
  reactions?: any[];
  reply_count?: number;
  user?: {
    id: string;
    full_name: string;
    profile_picture_url?: string | null;
    role: string;
    designation: string;
  };
  // Optimistic update fields
  _optimistic?: boolean;
  _sending?: boolean;
  _failed?: boolean;
}

interface SendMessageParams {
  channelId: string;
  content: string;
  threadParentId?: string | null;
  attachments?: File[];
}

interface QueuedMessage extends SendMessageParams {
  id: string;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = "communication_offline_queue";

export const useSendMessage = (wsClient?: WebSocketClient) => {
  const queryClient = useQueryClient();
  const [offlineQueue, setOfflineQueue] = useState<QueuedMessage[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const processingQueueRef = useRef(false);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (savedQueue) {
      try {
        const queue = JSON.parse(savedQueue);
        setOfflineQueue(queue);
      } catch (error) {
        console.error("Failed to load offline queue:", error);
      }
    }
  }, []);

  // Save offline queue to localStorage
  useEffect(() => {
    if (offlineQueue.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } else {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  }, [offlineQueue]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline. Messages will be queued.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Process offline queue when coming back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !processingQueueRef.current) {
      processOfflineQueue();
    }
  }, [isOnline, offlineQueue]);

  // Upload attachments to Supabase Storage
  const uploadAttachments = async (
    channelId: string,
    files: File[]
  ): Promise<any[]> => {
    const uploadedAttachments = [];

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${channelId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Failed to upload attachment:", error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("message-attachments").getPublicUrl(filePath);

      uploadedAttachments.push({
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      });
    }

    return uploadedAttachments;
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      channelId,
      content,
      threadParentId,
      attachments,
    }: SendMessageParams) => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload attachments if any
      let uploadedAttachments: any[] = [];
      if (attachments && attachments.length > 0) {
        uploadedAttachments = await uploadAttachments(channelId, attachments);
      }

      // Insert message into database
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          channel_id: channelId,
          thread_parent_id: threadParentId,
          user_id: user.id,
          content,
        })
        .select(
          `
          *,
          user:user_id (
            id,
            full_name,
            profile_picture_url,
            role,
            designation
          )
        `
        )
        .single();

      if (error) throw error;

      // Insert attachments if any
      if (uploadedAttachments.length > 0) {
        const { error: attachmentError } = await supabase
          .from("message_attachments")
          .insert(
            uploadedAttachments.map((att) => ({
              message_id: message.id,
              ...att,
            }))
          );

        if (attachmentError) {
          console.error("Failed to save attachments:", attachmentError);
        }
      }

      // Send via WebSocket for real-time delivery
      if (wsClient && wsClient.isConnected()) {
        wsClient.send({
          type: MessageType.SEND_MESSAGE,
          payload: {
            ...message,
            attachments: uploadedAttachments,
          },
        });
      }

      return { ...message, attachments: uploadedAttachments };
    },
    onMutate: async ({ channelId, content, threadParentId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", channelId],
      });

      // Get current user for optimistic update
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        channelId,
      ]);

      // Optimistically update cache
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        channel_id: channelId,
        thread_parent_id: threadParentId,
        user_id: user?.id || "",
        content,
        created_at: new Date().toISOString(),
        _optimistic: true,
        _sending: true,
        user: {
          id: user?.id || "",
          full_name: user?.user_metadata?.full_name || "You",
          profile_picture_url: user?.user_metadata?.profile_picture_url,
          role: user?.user_metadata?.role || "Employee",
          designation: user?.user_metadata?.designation || "",
        },
      };

      queryClient.setQueryData<Message[]>(
        ["messages", channelId],
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages, optimisticMessage };
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<Message[]>(
        ["messages", variables.channelId],
        (old = []) =>
          old.map((msg) =>
            msg.id === context?.optimisticMessage.id
              ? { ...data, _optimistic: false, _sending: false }
              : msg
          )
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.channelId],
      });
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", variables.channelId],
          context.previousMessages
        );
      }

      // Mark message as failed
      queryClient.setQueryData<Message[]>(
        ["messages", variables.channelId],
        (old = []) =>
          old.map((msg) =>
            msg.id === context?.optimisticMessage.id
              ? { ...msg, _sending: false, _failed: true }
              : msg
          )
      );

      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    },
  });

  // Queue message for offline sending
  const queueMessage = useCallback((params: SendMessageParams) => {
    const queuedMessage: QueuedMessage = {
      ...params,
      id: `queued-${Date.now()}`,
      timestamp: Date.now(),
    };

    setOfflineQueue((prev) => [...prev, queuedMessage]);
    toast.info("Message queued. Will send when online.");
  }, []);

  // Process offline queue
  const processOfflineQueue = useCallback(async () => {
    if (processingQueueRef.current || offlineQueue.length === 0) return;

    processingQueueRef.current = true;

    try {
      for (const queuedMsg of offlineQueue) {
        try {
          await sendMessageMutation.mutateAsync({
            channelId: queuedMsg.channelId,
            content: queuedMsg.content,
            threadParentId: queuedMsg.threadParentId,
            attachments: queuedMsg.attachments,
          });

          // Remove from queue on success
          setOfflineQueue((prev) => prev.filter((msg) => msg.id !== queuedMsg.id));
        } catch (error) {
          console.error("Failed to send queued message:", error);
          // Keep in queue for retry
        }
      }

      if (offlineQueue.length > 0) {
        toast.success(`Sent ${offlineQueue.length} queued messages`);
      }
    } finally {
      processingQueueRef.current = false;
    }
  }, [offlineQueue, sendMessageMutation]);

  // Main send function
  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      if (!isOnline) {
        queueMessage(params);
        return;
      }

      return sendMessageMutation.mutateAsync(params);
    },
    [isOnline, queueMessage, sendMessageMutation]
  );

  return {
    sendMessage,
    isSending: sendMessageMutation.isPending,
    isOnline,
    queuedCount: offlineQueue.length,
  };
};
