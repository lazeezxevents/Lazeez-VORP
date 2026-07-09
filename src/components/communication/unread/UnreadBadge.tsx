import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface UnreadBadgeProps {
  count: number;
  className?: string;
  maxCount?: number;
}

/**
 * UnreadBadge - Displays unread message count
 * 
 * Features:
 * - Animated badge appearance
 * - Compact display for large numbers (99+)
 * - Accessible color contrast
 * 
 * Requirements: 35.2, 35.5, 35.6
 */
export const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  count,
  className = '',
  maxCount = 99
}) => {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30
        }}
        className={className}
      >
        <Badge
          variant="destructive"
          className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-xs font-semibold"
        >
          {displayCount}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
};

interface UnreadIndicatorProps {
  hasUnread: boolean;
  className?: string;
}

/**
 * UnreadIndicator - Simple dot indicator for unread status
 */
export const UnreadIndicator: React.FC<UnreadIndicatorProps> = ({
  hasUnread,
  className = ''
}) => {
  if (!hasUnread) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`w-2 h-2 rounded-full bg-primary ${className}`}
    />
  );
};

interface UnreadSeparatorProps {
  className?: string;
}

/**
 * UnreadSeparator - Visual separator line for unread messages
 * 
 * Requirements: 35.3
 */
export const UnreadSeparator: React.FC<UnreadSeparatorProps> = ({
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative my-4 ${className}`}
    >
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-destructive" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs font-medium text-destructive">
          New messages
        </span>
      </div>
    </motion.div>
  );
};
