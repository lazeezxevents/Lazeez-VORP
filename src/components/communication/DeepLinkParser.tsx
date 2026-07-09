/**
 * DeepLinkParser Component
 * 
 * Parses and renders deep links to VORP entities within messages.
 * 
 * Requirements:
 * - 17.1: Support deep link syntax (#vendor-123, #po-456, etc.)
 * - 17.2: Display autocomplete for deep links
 * - 17.3: Render clickable links with entity preview
 * - 17.4: Navigate to entity on click
 * - 17.5: Display entity metadata
 * - 17.7: Display inactive styling for deleted entities
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package,
  FileText,
  CheckSquare,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";

interface DeepLinkProps {
  content: string;
}

interface EntityPreview {
  type: string;
  id: string;
  name: string;
  status?: string;
  metadata?: Record<string, any>;
  isDeleted?: boolean;
}

const DEEP_LINK_PATTERNS = {
  vendor: /#vendor-(\d+)/g,
  po: /#po-(\d+)/g,
  task: /#task-(\d+)/g,
  mou: /#mou-([A-Z0-9-]+)/g,
  issue: /#issue-(\d+)/g,
};

export const DeepLinkParser = ({ content }: DeepLinkProps) => {
  const navigate = useNavigate();
  const [entityPreviews, setEntityPreviews] = useState<
    Map<string, EntityPreview>
  >(new Map());

  useEffect(() => {
    loadEntityPreviews();
  }, [content]);

  const loadEntityPreviews = async () => {
    const previews = new Map<string, EntityPreview>();

    // Extract all deep links
    for (const [type, pattern] of Object.entries(DEEP_LINK_PATTERNS)) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const fullMatch = match[0];
        const id = match[1];

        try {
          const preview = await fetchEntityPreview(type, id);
          if (preview) {
            previews.set(fullMatch, preview);
          }
        } catch (error) {
          console.error(`Failed to load preview for ${fullMatch}:`, error);
        }
      }
    }

    setEntityPreviews(previews);
  };

  const fetchEntityPreview = async (
    type: string,
    id: string
  ): Promise<EntityPreview | null> => {
    switch (type) {
      case "vendor": {
        const { data } = await supabase
          .from("vendors")
          .select("id, name, status")
          .eq("id", id)
          .single();

        return data
          ? {
              type: "vendor",
              id: data.id,
              name: data.name,
              status: data.status,
            }
          : null;
      }

      case "issue": {
        const { data } = await supabase
          .from("issues")
          .select("id, title, status, priority")
          .eq("id", id)
          .single();

        return data
          ? {
              type: "issue",
              id: data.id,
              name: data.title,
              status: data.status,
              metadata: { priority: data.priority },
            }
          : null;
      }

      case "mou": {
        const { data } = await supabase
          .from("mous")
          .select("id, title, status")
          .eq("id", id)
          .single();

        return data
          ? {
              type: "mou",
              id: data.id,
              name: data.title,
              status: data.status,
            }
          : null;
      }

      case "task": {
        const { data } = await supabase
          .from("project_tasks")
          .select("id, title, status")
          .eq("id", id)
          .single();

        return data
          ? {
              type: "task",
              id: data.id,
              name: data.title,
              status: data.status,
            }
          : null;
      }

      default:
        return null;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "vendor":
        return Building2;
      case "po":
        return Package;
      case "mou":
        return FileText;
      case "task":
        return CheckSquare;
      case "issue":
        return AlertCircle;
      default:
        return FileText;
    }
  };

  const getEntityRoute = (type: string, id: string): string => {
    switch (type) {
      case "vendor":
        return `/vendors/${id}`;
      case "issue":
        return `/issues?id=${id}`;
      case "mou":
        return `/mous?id=${id}`;
      case "task":
        return `/projects?task=${id}`;
      default:
        return "#";
    }
  };

  const handleEntityClick = (type: string, id: string) => {
    const route = getEntityRoute(type, id);
    if (route !== "#") {
      navigate(route);
    }
  };

  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find all deep links
    const allMatches: Array<{ match: RegExpMatchArray; type: string }> = [];

    for (const [type, pattern] of Object.entries(DEEP_LINK_PATTERNS)) {
      const matches = Array.from(content.matchAll(pattern));
      matches.forEach((match) => {
        allMatches.push({ match, type });
      });
    }

    // Sort by position
    allMatches.sort((a, b) => a.match.index! - b.match.index!);

    // Render content with deep links
    allMatches.forEach(({ match, type }) => {
      const fullMatch = match[0];
      const id = match[1];
      const index = match.index!;

      // Add text before link
      if (index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, index)}
          </span>
        );
      }

      // Add deep link
      const preview = entityPreviews.get(fullMatch);
      const Icon = getEntityIcon(type);

      if (preview) {
        parts.push(
          <HoverCard key={`link-${index}`}>
            <HoverCardTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEntityClick(type, id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  preview.isDeleted
                    ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                    : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                }`}
              >
                <Icon className="w-3 h-3" />
                {fullMatch}
              </motion.button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">
                      {type}
                    </span>
                  </div>
                  {preview.status && (
                    <Badge variant="secondary" className="text-xs">
                      {preview.status}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{preview.name}</p>
                  {preview.metadata && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {Object.entries(preview.metadata).map(([key, value]) => (
                        <div key={key}>
                          {key}: {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      } else {
        // Fallback for links without preview
        parts.push(
          <span
            key={`link-${index}`}
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={() => handleEntityClick(type, id)}
          >
            {fullMatch}
          </span>
        );
      }

      lastIndex = index + fullMatch.length;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{content.substring(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="text-sm text-foreground whitespace-pre-wrap break-words">
      {renderContent()}
    </div>
  );
};
