/**
 * Empty States for Finance Module
 * Consistent empty state patterns across all finance components
 */

import { motion } from 'framer-motion';
import { 
  FileText, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  Search,
  Database,
  FileX,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Generic empty state component
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const DefaultIcon = Inbox;
  const IconComponent = Icon || DefaultIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center py-12 px-4"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        <IconComponent className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
      </motion.div>
      
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        {description}
      </p>
      
      {action && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * No transactions empty state
 */
export function NoTransactionsEmpty({ onCreateTransaction }: { onCreateTransaction?: () => void }) {
  return (
    <EmptyState
      icon={DollarSign}
      title="No transactions yet"
      description="Start recording financial transactions to track your business activity"
      action={onCreateTransaction ? {
        label: 'Create transaction',
        onClick: onCreateTransaction
      } : undefined}
    />
  );
}

/**
 * No invoices empty state
 */
export function NoInvoicesEmpty({ onCreateInvoice }: { onCreateInvoice?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No invoices found"
      description="Create your first invoice to start billing customers"
      action={onCreateInvoice ? {
        label: 'Create invoice',
        onClick: onCreateInvoice
      } : undefined}
    />
  );
}

/**
 * No receipts empty state
 */
export function NoReceiptsEmpty({ onUploadReceipt }: { onUploadReceipt?: () => void }) {
  return (
    <EmptyState
      icon={Receipt}
      title="No receipts uploaded"
      description="Upload receipts to track expenses and extract data automatically with AI"
      action={onUploadReceipt ? {
        label: 'Upload receipt',
        onClick: onUploadReceipt
      } : undefined}
    />
  );
}

/**
 * No reports empty state
 */
export function NoReportsEmpty({ onGenerateReport }: { onGenerateReport?: () => void }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="No reports available"
      description="Generate financial reports to analyze your business performance"
      action={onGenerateReport ? {
        label: 'Generate report',
        onClick: onGenerateReport
      } : undefined}
    />
  );
}

/**
 * No budgets empty state
 */
export function NoBudgetsEmpty({ onCreateBudget }: { onCreateBudget?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No budgets created"
      description="Create budgets to plan and track your financial goals"
      action={onCreateBudget ? {
        label: 'Create budget',
        onClick: onCreateBudget
      } : undefined}
    />
  );
}

/**
 * Search no results empty state
 */
export function SearchNoResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`No results found for "${query}". Try adjusting your search terms.`}
    />
  );
}

/**
 * Data not available empty state
 */
export function DataNotAvailable() {
  return (
    <EmptyState
      icon={Database}
      title="Data not available"
      description="The requested data is not available at this time. Please try again later."
    />
  );
}

/**
 * Error empty state
 */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description={message || "An error occurred while loading data. Please try again."}
      action={onRetry ? {
        label: 'Try again',
        onClick: onRetry
      } : undefined}
    />
  );
}

/**
 * No data for date range empty state
 */
export function NoDataForDateRange({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No data for selected period"
      description={`No data found between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}. Try selecting a different date range.`}
    />
  );
}

/**
 * Permission denied empty state
 */
export function PermissionDenied() {
  return (
    <EmptyState
      icon={FileX}
      title="Access denied"
      description="You don't have permission to view this content. Contact your administrator if you need access."
    />
  );
}

/**
 * Coming soon empty state
 */
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Coming soon"
      description={`${feature} is currently under development and will be available soon.`}
    />
  );
}

/**
 * Compact empty state for smaller spaces
 */
export function CompactEmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-6 text-muted-foreground"
    >
      <p className="text-sm">{message}</p>
    </motion.div>
  );
}

/**
 * Empty state with illustration
 */
export function IllustratedEmptyState({
  title,
  description,
  illustrationUrl,
  action
}: {
  title: string;
  description: string;
  illustrationUrl: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 px-4"
    >
      <img
        src={illustrationUrl}
        alt={title}
        className="w-64 h-64 mx-auto mb-6 opacity-75"
      />
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
