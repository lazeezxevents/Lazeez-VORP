/**
 * DirectMessageList Component Tests
 * Task 17.3: Write unit tests for direct messaging
 * 
 * Tests:
 * - Conversation list rendering
 * - Unread count display
 * - User presence indicators
 * - Search functionality
 * - Create conversation button
 * 
 * Requirements: 13.1, 13.2, 13.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DirectMessageList } from "../direct-messages/DirectMessageList";

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock PresenceBadge component
vi.mock('../presence/PresenceStatusSelector', () => ({
  PresenceBadge: ({ status, size }: any) => (
    <div data-testid={`presence-badge-${status}`} data-size={size} className={`presence-${status}`}>
      {status}
    </div>
  ),
}));

describe("DirectMessageList", () => {
  const mockConversations = [
    {
      id: "dm-1",
      otherUser: {
        id: "user-1",
        fullName: "Sarah Johnson",
        profilePictureUrl: "https://example.com/avatar1.jpg",
        email: "sarah@example.com",
        role: "Manager",
        designation: "Engineering Manager",
        presence: {
          status: "online" as const,
          customStatus: "In a meeting",
          lastSeen: new Date().toISOString(),
        },
      },
      lastMessage: {
        id: "msg-1",
        content: "Can we discuss the project timeline?",
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
        isRead: false,
        senderId: "user-1",
      },
      unreadCount: 2,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: "dm-2",
      otherUser: {
        id: "user-2",
        fullName: "Michael Chen",
        profilePictureUrl: null,
        email: "michael@example.com",
        role: "Employee",
        designation: "Software Engineer",
        presence: {
          status: "offline" as const,
          lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        },
      },
      lastMessage: {
        id: "msg-2",
        content: "Thanks for your help!",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        isRead: true,
        senderId: "current-user",
      },
      unreadCount: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
    {
      id: "dm-3",
      otherUser: {
        id: "user-3",
        fullName: "Emily Davis",
        profilePictureUrl: "https://example.com/avatar3.jpg",
        email: "emily@example.com",
        presence: {
          status: "dnd" as const,
          customStatus: "Focus time",
        },
      },
      lastMessage: undefined,
      unreadCount: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];

  const defaultProps = {
    conversations: mockConversations,
    activeConversationId: undefined,
    onSelectConversation: vi.fn(),
    onCreateConversation: vi.fn(),
    isLoading: false,
  };

  describe("Rendering", () => {
    it("should render the header with title", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByText("Direct messages")).toBeTruthy();
    });

    it("should render all conversations", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByText("Sarah Johnson")).toBeTruthy();
      expect(screen.getByText("Michael Chen")).toBeTruthy();
      expect(screen.getByText("Emily Davis")).toBeTruthy();
    });

    it("should render user avatars with fallback", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      // Sarah has a profile picture
      const sarahAvatar = screen.getByAltText("Sarah Johnson");
      expect(sarahAvatar.getAttribute("src")).toBe("https://example.com/avatar1.jpg");
      
      // Michael has no profile picture - should show fallback with initial
      expect(screen.getByText("M")).toBeTruthy(); // Fallback for Michael Chen
    });

    it("should display last message content", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByText("Can we discuss the project timeline?")).toBeTruthy();
      expect(screen.getByText("Thanks for your help!")).toBeTruthy();
    });

    it("should show 'No messages yet' for conversations without messages", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByText("No messages yet")).toBeTruthy();
    });

    it("should display custom status when available", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByText("In a meeting")).toBeTruthy();
      expect(screen.getByText("Focus time")).toBeTruthy();
    });
  });

  describe("Unread Count Display", () => {
    it("should display unread badge for conversations with unread messages", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      const unreadBadge = screen.getByText("2");
      expect(unreadBadge).toBeTruthy();
    });

    it("should not display unread badge for read conversations", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      // Michael Chen has 0 unread, so no badge should be shown for him
      const michaelContainer = screen.getByText("Michael Chen").closest("button");
      expect(michaelContainer?.textContent).not.toContain("0");
    });

    it("should show '99+' for unread counts over 99", () => {
      const conversationsWithManyUnread = [
        {
          ...mockConversations[0],
          unreadCount: 150,
        },
      ];
      
      render(
        <DirectMessageList
          {...defaultProps}
          conversations={conversationsWithManyUnread}
        />
      );
      
      expect(screen.getByText("99+")).toBeTruthy();
    });

    it("should highlight conversation names with unread messages", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      // Sarah has unread messages, her name should be bold
      const sarahName = screen.getByText("Sarah Johnson");
      expect(sarahName.className).toContain("font-semibold");
      
      // Michael has no unread, his name should not be bold
      const michaelName = screen.getByText("Michael Chen");
      expect(michaelName.className).not.toContain("font-semibold");
    });
  });

  describe("Presence Indicators", () => {
    it("should render presence badges for all conversations", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      expect(screen.getByTestId("presence-badge-online")).toBeTruthy();
      expect(screen.getByTestId("presence-badge-offline")).toBeTruthy();
      expect(screen.getByTestId("presence-badge-dnd")).toBeTruthy();
    });

    it("should pass correct status to presence badges", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      const onlineBadge = screen.getByTestId("presence-badge-online");
      expect(onlineBadge.textContent).toBe("online");
    });
  });

  describe("Time Formatting", () => {
    it("should format recent messages as 'Just now'", () => {
      const conversationsWithRecentMessage = [
        {
          ...mockConversations[0],
          lastMessage: {
            ...mockConversations[0].lastMessage!,
            createdAt: new Date(Date.now() - 1000 * 30).toISOString(), // 30 seconds ago
          },
        },
      ];
      
      render(
        <DirectMessageList
          {...defaultProps}
          conversations={conversationsWithRecentMessage}
        />
      );
      
      expect(screen.getByText("Just now")).toBeTruthy();
    });

    it("should format messages as minutes for recent messages", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      // 5 minutes ago should show as "5m"
      expect(screen.getByText("5m")).toBeTruthy();
    });

    it("should format messages as hours for older messages", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      // 3 hours ago should show as "3h"
      expect(screen.getByText("3h")).toBeTruthy();
    });
  });

  describe("Search Functionality", () => {
    it("should filter conversations based on search query", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText("Search conversations...");
      fireEvent.change(searchInput, { target: { value: "Sarah" } });
      
      expect(screen.getByText("Sarah Johnson")).toBeTruthy();
      expect(screen.queryByText("Michael Chen")).toBeNull();
      expect(screen.queryByText("Emily Davis")).toBeNull();
    });

    it("should show empty state when search has no results", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText("Search conversations...");
      fireEvent.change(searchInput, { target: { value: "NonExistentUser" } });
      
      expect(screen.getByText("No conversations found")).toBeTruthy();
      expect(screen.getByText("Try a different search")).toBeTruthy();
    });

    it("should be case-insensitive when searching", () => {
      render(<DirectMessageList {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText("Search conversations...");
      fireEvent.change(searchInput, { target: { value: "sarah" } });
      
      expect(screen.getByText("Sarah Johnson")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onSelectConversation when clicking a conversation", () => {
      const onSelectConversation = vi.fn();
      render(
        <DirectMessageList
          {...defaultProps}
          onSelectConversation={onSelectConversation}
        />
      );
      
      const conversation = screen.getByText("Sarah Johnson").closest("button");
      fireEvent.click(conversation!);
      
      expect(onSelectConversation).toHaveBeenCalledWith("dm-1");
    });

    it("should call onCreateConversation when clicking the plus button", () => {
      const onCreateConversation = vi.fn();
      render(
        <DirectMessageList
          {...defaultProps}
          onCreateConversation={onCreateConversation}
        />
      );
      
      const plusButton = screen.getByLabelText("New direct message");
      fireEvent.click(plusButton);
      
      expect(onCreateConversation).toHaveBeenCalled();
    });

    it("should highlight active conversation", () => {
      render(
        <DirectMessageList
          {...defaultProps}
          activeConversationId="dm-1"
        />
      );
      
      const activeConversation = screen.getByText("Sarah Johnson").closest("button");
      expect(activeConversation?.className).toContain("bg-accent");
    });
  });

  describe("Loading State", () => {
    it("should show loading skeleton when isLoading is true", () => {
      render(<DirectMessageList {...defaultProps} isLoading={true} conversations={[]} />);
      
      // Check for skeleton elements (animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no conversations exist", () => {
      render(<DirectMessageList {...defaultProps} conversations={[]} />);
      
      expect(screen.getByText("No direct messages yet")).toBeTruthy();
      expect(screen.getByText("Start a conversation with a colleague")).toBeTruthy();
    });

    it("should show New message button in empty state", () => {
      const onCreateConversation = vi.fn();
      render(
        <DirectMessageList
          {...defaultProps}
          conversations={[]}
          onCreateConversation={onCreateConversation}
        />
      );
      
      const newMessageButton = screen.getByText("New message");
      expect(newMessageButton).toBeTruthy();
      
      fireEvent.click(newMessageButton);
      expect(onCreateConversation).toHaveBeenCalled();
    });
  });
});
