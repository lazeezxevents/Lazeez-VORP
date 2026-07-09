/**
 * MentionAutocomplete Component
 * 
 * Provides @ mention autocomplete functionality with channel member filtering.
 * 
 * Requirements:
 * - 6.1: Display autocomplete dropdown triggered by @
 * - 6.2: Filter channel members by name as user types
 * - 6.4: Highlight mentions with distinct styling
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AtSign, Users } from "lucide-react";

interface ChannelMember {
  id: string;
  full_name: string;
  profile_picture_url?: string | null;
  role: string;
  designation: string;
  status?: "online" | "away" | "dnd" | "offline";
}

interface MentionAutocompleteProps {
  members: ChannelMember[];
  onSelect: (member: ChannelMember) => void;
  searchQuery: string;
  position: { top: number; left: number };
  onClose: () => void;
}

export const MentionAutocomplete = ({
  members,
  onSelect,
  searchQuery,
  position,
  onClose,
}: MentionAutocompleteProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter members by search query
  const filteredMembers = members.filter((member) =>
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const specialMentions: ChannelMember[] = [
    {
      id: "@channel",
      full_name: "channel",
      role: "special",
      designation: "Notify all channel members",
    },
    {
      id: "@here",
      full_name: "here",
      role: "special",
      designation: "Notify active members only",
    },
  ];

  const allOptions = searchQuery
    ? [...specialMentions, ...filteredMembers]
    : filteredMembers;

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allOptions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = allOptions[selectedIndex];
        if (pick) {
          onSelect(pick);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, allOptions, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = containerRef.current?.children[
      selectedIndex
    ] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  if (allOptions.length === 0) {
    return null;
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "dnd":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 w-80 max-h-64 overflow-y-auto bg-background border border-border rounded-lg shadow-lg"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-2 space-y-1">
          {allOptions.map((option, index) => {
            const isSpecial = option.role === "special";
            const isSelected = index === selectedIndex;

            return (
              <motion.button
                key={option.id}
                onClick={() => onSelect(option as ChannelMember)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {isSpecial ? (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {option.full_name === "channel" ? (
                      <Users className="w-5 h-5 text-primary" />
                    ) : (
                      <AtSign className="w-5 h-5 text-primary" />
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={option.profile_picture_url || undefined}
                        alt={option.full_name}
                      />
                      <AvatarFallback>
                        {option.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {option.status && (
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                          option.status
                        )}`}
                      />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {isSpecial ? `@${option.full_name}` : option.full_name}
                    </span>
                    {!isSpecial && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {option.role}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {option.designation}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
