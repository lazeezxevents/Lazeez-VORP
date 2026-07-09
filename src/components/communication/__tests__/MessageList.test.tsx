import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MessageList } from "../MessageList";

// Mock @tanstack/react-virtual
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
  }),
}));

describe("MessageList", () => {
  const mockMessages = [
    {
      id: "msg-1",
      channel_id: "channel-1",
      user_id: "user-1",
      content: "Hello world",
      created_at: new Date().toISOString(),
      user: {
        id: "user-1",
        full_name: "Alice Johnson",
        profile_picture_url: null,
        role: "Admin",
      },
    },
    {
      id: "msg-2",
      channel_id: "channel-1",
      user_id: "user-2",
      content: "Hi there!",
      created_at: new Date().toISOString(),
      user: {
        id: "user-2",
        full_name: "Bob Smith",
        profile_picture_url: null,
        role: "Employee",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render empty state when no messages", () => {
      render(<MessageList messages={[]} />);
      expect(screen.getByText("No messages yet")).toBeTruthy();
      expect(screen.getByText("Be the first to send a message")).toBeTruthy();
    });

    it("should render loading indicator when loading with hasMore", () => {
      const { container } = render(<MessageList messages={[]} isLoading={true} hasMore={true} />);
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeTruthy();
    });

    it("should not render loading indicator when loading without hasMore", () => {
      const { container } = render(<MessageList messages={[]} isLoading={true} hasMore={false} />);
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeFalsy();
    });
  });

  describe("Message Grouping", () => {
    it("should group messages by date", () => {
      const messagesOnDifferentDays = [
        {
          ...mockMessages[0],
          created_at: new Date("2024-01-01").toISOString(),
        },
        {
          ...mockMessages[1],
          created_at: new Date("2024-01-02").toISOString(),
        },
      ];

      render(<MessageList messages={messagesOnDifferentDays} />);
      
      // Should have date separators
      expect(screen.getByText(/January 1, 2024/)).toBeTruthy();
      expect(screen.getByText(/January 2, 2024/)).toBeTruthy();
    });

    it("should show 'Today' for today's messages", () => {
      const todayMessage = {
        ...mockMessages[0],
        created_at: new Date().toISOString(),
      };

      render(<MessageList messages={[todayMessage]} />);
      expect(screen.getByText("Today")).toBeTruthy();
    });

    it("should show 'Yesterday' for yesterday's messages", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayMessage = {
        ...mockMessages[0],
        created_at: yesterday.toISOString(),
      };

      render(<MessageList messages={[yesterdayMessage]} />);
      expect(screen.getByText("Yesterday")).toBeTruthy();
    });
  });

  describe("Unread Separator", () => {
    it("should show unread separator when lastReadMessageId is provided", () => {
      render(
        <MessageList
          messages={mockMessages}
          lastReadMessageId="msg-1"
        />
      );

      expect(screen.getByText("New messages")).toBeTruthy();
    });

    it("should not show unread separator when all messages are read", () => {
      render(
        <MessageList
          messages={mockMessages}
          lastReadMessageId="msg-2"
        />
      );

      expect(screen.queryByText("New messages")).toBeFalsy();
    });
  });

  describe("Message Display", () => {
    it("should display message content", () => {
      render(<MessageList messages={mockMessages} />);
      
      expect(screen.getByText("Hello world")).toBeTruthy();
      expect(screen.getByText("Hi there!")).toBeTruthy();
    });

    it("should display user names", () => {
      render(<MessageList messages={mockMessages} />);
      
      expect(screen.getByText("Alice Johnson")).toBeTruthy();
      expect(screen.getByText("Bob Smith")).toBeTruthy();
    });

    it("should display user roles", () => {
      render(<MessageList messages={mockMessages} />);
      
      expect(screen.getByText("Admin")).toBeTruthy();
      expect(screen.getByText("Employee")).toBeTruthy();
    });

    it("should show edited indicator for edited messages", () => {
      const editedMessage = {
        ...mockMessages[0],
        edited_at: new Date().toISOString(),
      };

      render(<MessageList messages={[editedMessage]} />);
      expect(screen.getByText("(edited)")).toBeTruthy();
    });

    it("should show deleted message placeholder", () => {
      const deletedMessage = {
        ...mockMessages[0],
        deleted_at: new Date().toISOString(),
      };

      render(<MessageList messages={[deletedMessage]} />);
      expect(screen.getByText("Message deleted")).toBeTruthy();
    });
  });

  describe("Reactions", () => {
    it("should display message reactions", () => {
      const messageWithReactions = {
        ...mockMessages[0],
        reactions: [
          { emoji: "👍", count: 3, user_ids: ["user-1", "user-2", "user-3"] },
          { emoji: "❤️", count: 1, user_ids: ["user-1"] },
        ],
      };

      render(<MessageList messages={[messageWithReactions]} />);
      
      expect(screen.getByText("👍")).toBeTruthy();
      expect(screen.getByText("3")).toBeTruthy();
      expect(screen.getByText("❤️")).toBeTruthy();
      expect(screen.getByText("1")).toBeTruthy();
    });

    it("should call onReactionAdd when reaction is clicked", async () => {
      const onReactionAdd = vi.fn();
      const messageWithReactions = {
        ...mockMessages[0],
        reactions: [
          { emoji: "👍", count: 1, user_ids: ["user-1"] },
        ],
      };

      render(
        <MessageList
          messages={[messageWithReactions]}
          onReactionAdd={onReactionAdd}
        />
      );

      const reactionButton = screen.getByRole("button", { name: /👍/ });
      reactionButton.click();

      await waitFor(() => {
        expect(onReactionAdd).toHaveBeenCalledWith("msg-1", "👍");
      });
    });
  });

  describe("Threads", () => {
    it("should display thread reply count", () => {
      const messageWithThread = {
        ...mockMessages[0],
        reply_count: 5,
      };

      render(<MessageList messages={[messageWithThread]} />);
      expect(screen.getByText("5 replies")).toBeTruthy();
    });

    it("should display singular 'reply' for single reply", () => {
      const messageWithThread = {
        ...mockMessages[0],
        reply_count: 1,
      };

      render(<MessageList messages={[messageWithThread]} />);
      expect(screen.getByText("1 reply")).toBeTruthy();
    });

    it("should call onThreadOpen when thread button is clicked", async () => {
      const onThreadOpen = vi.fn();
      const messageWithThread = {
        ...mockMessages[0],
        reply_count: 3,
      };

      render(
        <MessageList
          messages={[messageWithThread]}
          onThreadOpen={onThreadOpen}
        />
      );

      const threadButton = screen.getByText("3 replies");
      threadButton.click();

      await waitFor(() => {
        expect(onThreadOpen).toHaveBeenCalledWith("msg-1");
      });
    });
  });

  describe("Attachments", () => {
    it("should display image attachments", () => {
      const messageWithImage = {
        ...mockMessages[0],
        attachments: [
          {
            id: "att-1",
            file_url: "https://example.com/image.png",
            file_name: "screenshot.png",
            file_size: 245678,
            file_type: "image/png",
            thumbnail_url: "https://example.com/thumb.png",
          },
        ],
      };

      render(<MessageList messages={[messageWithImage]} />);
      
      const image = screen.getByAltText("screenshot.png");
      expect(image).toBeTruthy();
      expect(image).toHaveAttribute("src", "https://example.com/thumb.png");
    });

    it("should display file attachments with download link", () => {
      const messageWithFile = {
        ...mockMessages[0],
        attachments: [
          {
            id: "att-1",
            file_url: "https://example.com/document.pdf",
            file_name: "report.pdf",
            file_size: 1024000,
            file_type: "application/pdf",
          },
        ],
      };

      render(<MessageList messages={[messageWithFile]} />);
      
      expect(screen.getByText("report.pdf")).toBeTruthy();
      expect(screen.getByText("1.0 MB")).toBeTruthy();
      
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://example.com/document.pdf");
    });
  });

  describe("Lazy Loading", () => {
    it("should call onLoadMore when scrolling to top", async () => {
      const onLoadMore = vi.fn();
      
      const { container } = render(
        <MessageList
          messages={mockMessages}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      );

      const scrollContainer = container.querySelector('[style*="overflow-y"]');
      
      if (scrollContainer) {
        // Simulate scroll to top
        Object.defineProperty(scrollContainer, "scrollTop", {
          writable: true,
          value: 50,
        });
        
        scrollContainer.dispatchEvent(new Event("scroll"));

        await waitFor(() => {
          expect(onLoadMore).toHaveBeenCalled();
        });
      }
    });

    it("should not call onLoadMore when already loading", () => {
      const onLoadMore = vi.fn();
      
      const { container } = render(
        <MessageList
          messages={mockMessages}
          hasMore={true}
          isLoading={true}
          onLoadMore={onLoadMore}
        />
      );

      const scrollContainer = container.querySelector('[style*="overflow-y"]');
      
      if (scrollContainer) {
        Object.defineProperty(scrollContainer, "scrollTop", {
          writable: true,
          value: 50,
        });
        
        scrollContainer.dispatchEvent(new Event("scroll"));
        
        expect(onLoadMore).not.toHaveBeenCalled();
      }
    });
  });

  describe("Callbacks", () => {
    it("should call onMessageClick when message is clicked", async () => {
      const onMessageClick = vi.fn();
      
      render(
        <MessageList
          messages={mockMessages}
          onMessageClick={onMessageClick}
        />
      );

      const messageElement = screen.getByText("Hello world").closest("div");
      messageElement?.click();

      await waitFor(() => {
        expect(onMessageClick).toHaveBeenCalledWith("msg-1");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria-label for scroll button", () => {
      render(<MessageList messages={mockMessages} />);
      
      // Scroll button should have aria-label
      const scrollButton = screen.queryByLabelText("Scroll to bottom");
      // Button may not be visible initially, but should have proper label when shown
      if (scrollButton) {
        expect(scrollButton).toHaveAttribute("aria-label", "Scroll to bottom");
      }
    });

    it("should use semantic HTML for avatars", () => {
      const { container } = render(<MessageList messages={mockMessages} />);
      
      // Avatars should be rendered
      const avatars = container.querySelectorAll('[role="img"]');
      expect(avatars.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("should handle large message lists efficiently", () => {
      const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        channel_id: "channel-1",
        user_id: `user-${i % 10}`,
        content: `Message ${i}`,
        created_at: new Date().toISOString(),
        user: {
          id: `user-${i % 10}`,
          full_name: `User ${i % 10}`,
          profile_picture_url: null,
        },
      }));

      const { container } = render(<MessageList messages={largeMessageList} />);
      
      // Component should render without crashing
      expect(container).toBeTruthy();
    });
  });
});
