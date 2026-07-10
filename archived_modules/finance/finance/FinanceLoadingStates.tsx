/**
 * Loading States for Finance Module
 * Consistent loading patterns across all finance components
 */

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

/**
 * Dashboard loading skeleton
 */
export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>

      {/* Table */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Table loading skeleton
 */
export function TableLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/**
 * Form loading skeleton
 */
export function FormLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/**
 * Card loading skeleton
 */
export function CardLoadingSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

/**
 * Inline loading spinner
 */
export function InlineLoader({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="inline-flex items-center justify-center"
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-muted-foreground`} />
    </motion.div>
  );
}

/**
 * Full page loader
 */
export function FullPageLoader({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[400px] space-y-4"
    >
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </motion.div>
  );
}

/**
 * Shimmer effect for inline updates
 */
export function ShimmerValue({ width = 'w-20' }: { width?: string }) {
  return (
    <div className={`shimmer h-4 ${width} rounded`} />
  );
}

/**
 * Loading overlay for forms
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="flex flex-col items-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        {message && (
          <p className="text-sm font-medium">{message}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Staggered loading animation
 */
export function StaggeredLoader({ count = 3 }: { count?: number }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={itemVariants}>
          <Skeleton className="h-16 w-full" />
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Progress bar loader
 */
export function ProgressLoader({ progress }: { progress: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Processing...</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <div className="h-2 bg-accent rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          className="h-full bg-primary"
        />
      </div>
    </div>
  );
}
