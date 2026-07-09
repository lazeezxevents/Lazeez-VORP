import React from 'react';
import { motion } from 'framer-motion';
import {
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Strikethrough
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface FormattingToolbarProps {
  onFormat: (format: FormatType) => void;
  className?: string;
}

export type FormatType =
  | 'bold'
  | 'italic'
  | 'code'
  | 'strike'
  | 'list'
  | 'orderedList'
  | 'quote';

/**
 * FormattingToolbar - Provides markdown formatting buttons
 * 
 * Features:
 * - Insert markdown syntax on button click
 * - Show keyboard shortcuts in tooltips
 * - Support bold, italic, code, lists, quotes
 * 
 * Requirements: 25.12
 */
export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  className = ''
}) => {
  const formatButtons: Array<{
    type: FormatType;
    icon: React.ReactNode;
    label: string;
    shortcut: string;
  }> = [
    {
      type: 'bold',
      icon: <Bold className="w-4 h-4" />,
      label: 'Bold',
      shortcut: '⌘B'
    },
    {
      type: 'italic',
      icon: <Italic className="w-4 h-4" />,
      label: 'Italic',
      shortcut: '⌘I'
    },
    {
      type: 'strike',
      icon: <Strikethrough className="w-4 h-4" />,
      label: 'Strikethrough',
      shortcut: '⌘⇧X'
    },
    {
      type: 'code',
      icon: <Code className="w-4 h-4" />,
      label: 'Code',
      shortcut: '⌘E'
    },
    {
      type: 'list',
      icon: <List className="w-4 h-4" />,
      label: 'Bullet list',
      shortcut: '⌘⇧8'
    },
    {
      type: 'orderedList',
      icon: <ListOrdered className="w-4 h-4" />,
      label: 'Numbered list',
      shortcut: '⌘⇧7'
    },
    {
      type: 'quote',
      icon: <Quote className="w-4 h-4" />,
      label: 'Quote',
      shortcut: '⌘⇧>'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-1 p-1 bg-muted/50 rounded-md ${className}`}
    >
      {formatButtons.map((button) => (
        <Tooltip key={button.type}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat(button.type)}
              className="h-8 w-8 p-0 hover:bg-accent"
            >
              {button.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-center">
              <div className="font-medium">{button.label}</div>
              <div className="text-xs text-muted-foreground">{button.shortcut}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </motion.div>
  );
};

/**
 * Apply markdown formatting to selected text
 */
export const applyFormatting = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: FormatType
): { newText: string; newCursorPos: number } => {
  const selectedText = text.substring(selectionStart, selectionEnd);
  const before = text.substring(0, selectionStart);
  const after = text.substring(selectionEnd);

  let formattedText = '';
  let cursorOffset = 0;

  switch (format) {
    case 'bold':
      formattedText = `**${selectedText || 'bold text'}**`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;

    case 'italic':
      formattedText = `*${selectedText || 'italic text'}*`;
      cursorOffset = selectedText ? formattedText.length : 1;
      break;

    case 'strike':
      formattedText = `~~${selectedText || 'strikethrough text'}~~`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;

    case 'code':
      if (selectedText.includes('\n')) {
        // Multi-line code block
        formattedText = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
        cursorOffset = selectedText ? formattedText.length : 4;
      } else {
        // Inline code
        formattedText = `\`${selectedText || 'code'}\``;
        cursorOffset = selectedText ? formattedText.length : 1;
      }
      break;

    case 'list':
      if (selectedText) {
        const lines = selectedText.split('\n');
        formattedText = lines.map(line => `- ${line}`).join('\n');
      } else {
        formattedText = '- List item';
      }
      cursorOffset = formattedText.length;
      break;

    case 'orderedList':
      if (selectedText) {
        const lines = selectedText.split('\n');
        formattedText = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
      } else {
        formattedText = '1. List item';
      }
      cursorOffset = formattedText.length;
      break;

    case 'quote':
      if (selectedText) {
        const lines = selectedText.split('\n');
        formattedText = lines.map(line => `> ${line}`).join('\n');
      } else {
        formattedText = '> Quote';
      }
      cursorOffset = formattedText.length;
      break;

    default:
      formattedText = selectedText;
      cursorOffset = formattedText.length;
  }

  const newText = before + formattedText + after;
  const newCursorPos = selectionStart + cursorOffset;

  return { newText, newCursorPos };
};
