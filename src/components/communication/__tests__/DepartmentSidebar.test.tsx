import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DepartmentSidebar } from "../DepartmentSidebar";

const mockDepartments = [
  {
    id: "dept-1",
    name: "Engineering",
    description: "Engineering team",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const mockChannels = [
  {
    id: "ch-general",
    department_id: "dept-0",
    name: "general",
    description: "",
    is_private: false,
    is_archived: false,
    unread_count: 2,
  },
  {
    id: "ch-1",
    department_id: "dept-1",
    name: "dev",
    description: "",
    is_private: false,
    is_archived: false,
    unread_count: 0,
  },
];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    hasPermission: () => false,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === "departments") {
      return { data: mockDepartments, isLoading: false };
    }
    if (key === "channels") {
      return { data: mockChannels, isLoading: false };
    }
    return { data: [], isLoading: false };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

describe("DepartmentSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and lists general channel when data is loaded", () => {
    render(<DepartmentSidebar onChannelSelect={vi.fn()} />);

    expect(screen.getByText("Communication")).toBeTruthy();
    expect(screen.getByText("general")).toBeTruthy();
    expect(screen.getByText("Engineering")).toBeTruthy();
  });

  it("calls onChannelSelect with id and name when a channel is clicked", () => {
    const onChannelSelect = vi.fn();
    render(<DepartmentSidebar onChannelSelect={onChannelSelect} />);

    fireEvent.click(screen.getByText("general"));

    expect(onChannelSelect).toHaveBeenCalledWith("ch-general", "general");
  });
});
