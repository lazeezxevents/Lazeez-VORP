/**
 * MessageContent Component
 * 
 * Renders message content with mention highlighting and markdown support.
 * All content is sanitized to prevent XSS attacks.
 * 
 * Requirements:
 * - 6.4: Highlight mentions with distinct styling
 * - 34.1-34.9: Support markdown formatting
 * - 20.1, 34.12: Sanitize all user input to prevent XSS
 */

import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { sanitizeMarkdown } from "./security/inputSanitization";
import "highlight.js/styles/github-dark.css";

interface MessageContentProps {
  content: string;
  currentUserId?: string;
}

export const MessageContent = memo(
  ({ content, currentUserId }: MessageContentProps) => {
    // Sanitize and process content
    const processedContent = useMemo(() => {
      // First, sanitize the raw content
      const sanitized = sanitizeMarkdown(content);
      
      // Then parse for mentions and format them
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      // Regex to match @mentions (before HTML conversion)
      const mentionRegex = /@(\w+)/g;
      let match;

      // Work with the original content for mention detection
      while ((match = mentionRegex.exec(content)) !== null) {
        // Add sanitized text before mention
        if (match.index > lastIndex) {
          const beforeText = content.substring(lastIndex, match.index);
          const sanitizedBefore = sanitizeMarkdown(beforeText);
          parts.push(
            <span 
              key={`text-${lastIndex}`}
              dangerouslySetInnerHTML={{ __html: sanitizedBefore }}
            />
          );
        }

        // Add mention with styling
        const mentionName = match[1];
        const isSpecialMention =
          mentionName === "channel" || mentionName === "here";

        parts.push(
          <Badge
            key={`mention-${match.index}`}
            variant={isSpecialMention ? "default" : "secondary"}
            className={`mx-0.5 px-1.5 py-0 text-xs font-medium ${
              isSpecialMention
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "bg-blue-500/20 text-blue-600 hover:bg-blue-500/30"
            }`}
          >
            @{mentionName}
          </Badge>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining sanitized text
      if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        const sanitizedRemaining = sanitizeMarkdown(remainingText);
        parts.push(
          <span 
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ __html: sanitizedRemaining }}
          />
        );
      }

      return parts.length > 0 ? parts : (
        <span dangerouslySetInnerHTML={{ __html: sanitized }} />
      );
    }, [content]);

    return (
      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
        {processedContent}
      </div>
    );
  }
);

MessageContent.displayName = "MessageContent";
