import React from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer - Renders markdown-formatted text with syntax highlighting
 * 
 * Supports:
 * - Bold (**text**)
 * - Italic (*text*)
 * - Strikethrough (~~text~~)
 * - Inline code (`code`)
 * - Code blocks (```language\ncode\n```)
 * - Bulleted lists (- or *)
 * - Numbered lists (1.)
 * - Blockquotes (>)
 * 
 * Requirements: 34.1-34.9
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = ''
}) => {
  const renderMarkdown = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    // Code block regex: ```language\ncode\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    
    // Process code blocks first
    let match;
    const codeBlocks: { start: number; end: number; language: string; code: string }[] = [];
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    // Process text between code blocks
    codeBlocks.forEach((block, index) => {
      // Add text before code block
      if (currentIndex < block.start) {
        const textBefore = text.substring(currentIndex, block.start);
        elements.push(...renderInlineMarkdown(textBefore, `text-${index}`));
      }

      // Add code block
      elements.push(
        <motion.div
          key={`code-${index}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="my-2 rounded-md border bg-muted/50 overflow-hidden"
        >
          {block.language && block.language !== 'text' ? (
            <div className="px-3 py-1 text-xs font-mono text-muted-foreground border-b bg-muted/80">
              {block.language}
            </div>
          ) : null}
          <pre className="p-4 text-sm font-mono overflow-x-auto m-0">
            <code>{block.code}</code>
          </pre>
        </motion.div>
      );

      currentIndex = block.end;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      elements.push(...renderInlineMarkdown(remainingText, 'remaining'));
    }

    return elements;
  };

  const renderInlineMarkdown = (text: string, keyPrefix: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Blockquote (>)
      if (line.trim().startsWith('>')) {
        const quoteText = line.trim().substring(1).trim();
        elements.push(
          <blockquote
            key={`${keyPrefix}-quote-${lineIndex}`}
            className="border-l-4 border-primary/30 pl-4 py-2 my-2 text-muted-foreground italic"
          >
            {processInlineFormatting(quoteText)}
          </blockquote>
        );
        return;
      }

      // Bulleted list (- or *)
      if (line.trim().match(/^[-*]\s/)) {
        const listText = line.trim().substring(2);
        elements.push(
          <li
            key={`${keyPrefix}-bullet-${lineIndex}`}
            className="ml-6 list-disc my-1"
          >
            {processInlineFormatting(listText)}
          </li>
        );
        return;
      }

      // Numbered list (1.)
      if (line.trim().match(/^\d+\.\s/)) {
        const listText = line.trim().replace(/^\d+\.\s/, '');
        elements.push(
          <li
            key={`${keyPrefix}-number-${lineIndex}`}
            className="ml-6 list-decimal my-1"
          >
            {processInlineFormatting(listText)}
          </li>
        );
        return;
      }

      // Regular paragraph
      if (line.trim()) {
        elements.push(
          <p key={`${keyPrefix}-p-${lineIndex}`} className="my-1">
            {processInlineFormatting(line)}
          </p>
        );
      } else {
        elements.push(<br key={`${keyPrefix}-br-${lineIndex}`} />);
      }
    });

    return elements;
  };

  const processInlineFormatting = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    // Patterns for inline formatting
    const patterns = [
      { regex: /`([^`]+)`/g, type: 'code' },           // Inline code
      { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },     // Bold
      { regex: /\*([^*]+)\*/g, type: 'italic' },       // Italic
      { regex: /~~([^~]+)~~/g, type: 'strike' }        // Strikethrough
    ];

    // Find all matches
    const matches: { start: number; end: number; type: string; content: string }[] = [];
    
    patterns.forEach(({ regex, type }) => {
      let match;
      const tempRegex = new RegExp(regex.source, regex.flags);
      while ((match = tempRegex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          content: match[1]
        });
      }
    });

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep first)
    const filteredMatches = matches.filter((match, index) => {
      if (index === 0) return true;
      const prevMatch = matches[index - 1];
      return match.start >= prevMatch.end;
    });

    // Build elements
    filteredMatches.forEach((match, index) => {
      // Add text before match
      if (currentIndex < match.start) {
        const textBefore = text.substring(currentIndex, match.start);
        elements.push(
          <span key={`text-${index}`}>
            {DOMPurify.sanitize(textBefore, { ALLOWED_TAGS: [] })}
          </span>
        );
      }

      // Add formatted element
      switch (match.type) {
        case 'code':
          elements.push(
            <code
              key={`code-${index}`}
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
            >
              {match.content}
            </code>
          );
          break;
        case 'bold':
          elements.push(
            <strong key={`bold-${index}`} className="font-semibold">
              {match.content}
            </strong>
          );
          break;
        case 'italic':
          elements.push(
            <em key={`italic-${index}`} className="italic">
              {match.content}
            </em>
          );
          break;
        case 'strike':
          elements.push(
            <del key={`strike-${index}`} className="line-through opacity-70">
              {match.content}
            </del>
          );
          break;
      }

      currentIndex = match.end;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      elements.push(
        <span key="remaining">
          {DOMPurify.sanitize(remainingText, { ALLOWED_TAGS: [] })}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className={`markdown-content ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
};
