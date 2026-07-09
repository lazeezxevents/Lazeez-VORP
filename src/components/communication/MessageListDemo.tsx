import { useState } from "react";
import { MessageList } from "./MessageList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * MessageListDemo - Demo component showcasing MessageList functionality
 * 
 * This demo shows:
 * - Virtualized scrolling with 100+ messages
 * - Message grouping by date and user
 * - Unread separator
 * - Lazy loading simulation
 * - Smooth scroll to bottom
 */
export const MessageListDemo = () => {
  const [messages, setMessages] = useState(generateMockMessages(100));
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore] = useState(true);

  const currentUserId = "user-1";
  const lastReadMessageId = messages[70]?.id; // Mark first 70 as read

  const handleLoadMore = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newMessages = generateMockMessages(50, messages.length);
      setMessages([...newMessages, ...messages]);
      setIsLoading(false);
    }, 1000);
  };

  const handleMessageClick = (messageId: string) => {
    console.log("Message clicked:", messageId);
  };

  const handleReactionAdd = (messageId: string, emoji: string) => {
    console.log("Reaction added:", messageId, emoji);
  };

  const handleThreadOpen = (messageId: string) => {
    console.log("Thread opened:", messageId);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>MessageList component demo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Virtualized message list with lazy loading, grouping, and unread separator
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] border border-border rounded-lg overflow-hidden">
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              channelId="channel-1"
              lastReadMessageId={lastReadMessageId}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              onMessageClick={handleMessageClick}
              onReactionAdd={handleReactionAdd}
              onThreadOpen={handleThreadOpen}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Mock data generator
function generateMockMessages(count: number, startIndex: number = 0) {
  const users = [
    {
      id: "user-1",
      full_name: "Alice Johnson",
      profile_picture_url: null,
      role: "Admin",
      designation: "Engineering Manager",
    },
    {
      id: "user-2",
      full_name: "Bob Smith",
      profile_picture_url: null,
      role: "Manager",
      designation: "Product Manager",
    },
    {
      id: "user-3",
      full_name: "Carol Williams",
      profile_picture_url: null,
      role: "Employee",
      designation: "Software Engineer",
    },
    {
      id: "user-4",
      full_name: "David Brown",
      profile_picture_url: null,
      role: "Employee",
      designation: "UX Designer",
    },
  ];

  const messages = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const user = users[index % users.length];
    const daysAgo = Math.floor(index / 20); // Group by days
    const messageDate = new Date(now);
    messageDate.setDate(messageDate.getDate() - daysAgo);
    messageDate.setHours(9 + (index % 8));
    messageDate.setMinutes(index % 60);

    const hasReactions = Math.random() > 0.7;
    const hasThread = Math.random() > 0.8;
    const hasAttachment = Math.random() > 0.9;

    messages.push({
      id: `message-${index}`,
      channel_id: "channel-1",
      user_id: user.id,
      content: generateMessageContent(index),
      created_at: messageDate.toISOString(),
      edited_at: Math.random() > 0.9 ? messageDate.toISOString() : null,
      deleted_at: null,
      user,
      reactions: hasReactions
        ? [
            { emoji: "👍", count: Math.floor(Math.random() * 5) + 1, user_ids: [] },
            { emoji: "❤️", count: Math.floor(Math.random() * 3) + 1, user_ids: [] },
          ]
        : [],
      reply_count: hasThread ? Math.floor(Math.random() * 10) + 1 : 0,
      attachments: hasAttachment
        ? [
            {
              id: `attachment-${index}`,
              file_url: "https://via.placeholder.com/400x300",
              file_name: "screenshot.png",
              file_size: 245678,
              file_type: "image/png",
              thumbnail_url: "https://via.placeholder.com/400x300",
            },
          ]
        : [],
    });
  }

  return messages.reverse(); // Oldest first
}

function generateMessageContent(index: number): string {
  const messages = [
    "Hey team, just wanted to share an update on the project.",
    "Great work on the last sprint! 🎉",
    "Can someone review this PR when you get a chance?",
    "Meeting in 10 minutes, don't forget!",
    "I've updated the documentation with the latest changes.",
    "Quick question about the API endpoint...",
    "Thanks for the feedback, I'll make those changes.",
    "The deployment went smoothly, everything looks good.",
    "Let's discuss this in the standup tomorrow.",
    "I'm working on the bug fix now, should be ready soon.",
    "Does anyone have experience with this library?",
    "The new feature is ready for testing!",
    "I'll be out of office tomorrow, back on Monday.",
    "Great idea! Let's implement that.",
    "Can we schedule a quick sync to discuss this?",
    "I've added some comments to the design doc.",
    "The performance improvements are looking really good.",
    "We should consider adding tests for this.",
    "I'm seeing an error in production, investigating now.",
    "The client loved the demo! 🚀",
  ];

  return messages[index % messages.length];
}
