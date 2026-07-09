/**
 * RateLimitIndicator
 * 
 * Displays current rate limit status to users
 * 
 * Requirements:
 * - 20.4: Display error message when rate limit exceeded
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { RateLimiterService } from "@/services/RateLimiterService";
import { useAuth } from "@/contexts/AuthContext";

interface RateLimitIndicatorProps {
  action: 'messages' | 'file_uploads';
  className?: string;
}

/**
 * RateLimitIndicator - Shows rate limit status
 * 
 * Displays a warning when user is approaching rate limit
 * and shows countdown when rate limited
 */
export const RateLimitIndicator = ({
  action,
  className,
}: RateLimitIndicatorProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<{
    count: number;
    limit: number;
    resetAt: Date;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Update status every second
  useEffect(() => {
    if (!user) return;

    const updateStatus = async () => {
      const result = await RateLimiterService.getRateLimitStatus(user.id, action);
      setStatus(result);

      // Calculate time remaining
      const now = Date.now();
      const resetTime = result.resetAt.getTime();
      const remaining = Math.max(0, Math.ceil((resetTime - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [user, action]);

  if (!status || !user) return null;

  const percentage = (status.count / status.limit) * 100;
  const isWarning = percentage >= 80;
  const isLimited = status.count >= status.limit;

  // Only show when approaching limit or limited
  if (percentage < 80) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
          isLimited
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-warning/10 text-warning border border-warning/20",
          className
        )}
      >
        {isLimited ? (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Rate limit reached</span>
            <div className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                Reset in {timeRemaining}s
              </span>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">
              {status.limit - status.count} {action === 'messages' ? 'messages' : 'uploads'} remaining
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                Resets in {timeRemaining}s
              </span>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
