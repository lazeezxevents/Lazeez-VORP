import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Building2,
  ArrowRight,
} from "lucide-react";
import { usePendingPayouts, usePayoutSummary, useProcessPayout } from "./useVendorPayouts";
import { useState } from "react";
import { PayoutDetailView } from "./PayoutDetailView";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Vendor Payout Dashboard
 * 
 * Displays payout overview with:
 * - Summary cards showing pending, processing, and completed payouts
 * - List of pending payouts with action buttons
 * - Staggered entry animations
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * Task: 17.3 Implement vendor payout processing UI
 */

// =====================================================
// ANIMATION VARIANTS
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// =====================================================
// COMPONENT
// =====================================================

export function VendorPayoutDashboard() {
  const { data: pendingPayouts, isLoading: isLoadingPayouts } = usePendingPayouts();
  const { data: summary, isLoading: isLoadingSummary } = usePayoutSummary();
  const processPayout = useProcessPayout();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleProcessPayout = async (vendorId: string, orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Are you sure you want to process this payout? This action will create journal entries and update vendor balances.")) {
      await processPayout.mutateAsync({ vendor_id: vendorId, order_id: orderId });
    }
  };

  if (isLoadingPayouts || isLoadingSummary) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-6"
      >
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending payouts
                </CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  ₨{summary?.total_pending.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.pending_count || 0} orders awaiting payout
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Processing
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-info" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-info">
                  ₨{summary?.total_processing.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.processing_count || 0} payouts in progress
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed today
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  ₨{summary?.total_completed_today.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Payouts processed today
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total vendors
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(pendingPayouts?.map(p => p.vendor_id) || []).size}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vendors with pending payouts
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Pending Payouts List */}
        {pendingPayouts && pendingPayouts.length > 0 ? (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning" />
                  Pending payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingPayouts.map((payout, index) => (
                    <motion.div
                      key={payout.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setSelectedOrderId(payout.order_id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{payout.vendor_name}</span>
                              <Badge variant="outline" className="text-xs">
                                Order #{payout.order_number}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>Order: ₨{payout.order_amount.toLocaleString()}</span>
                              <span>•</span>
                              <span>Commission: ₨{payout.commission_amount.toLocaleString()} ({payout.commission_rate}%)</span>
                              <span>•</span>
                              <span>Upfront: ₨{payout.upfront_amount.toLocaleString()} ({payout.upfront_percentage}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Net payout</div>
                          <div className="text-xl font-bold text-success">
                            ₨{payout.net_payout.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => handleProcessPayout(payout.vendor_id, payout.order_id, e)}
                          disabled={processPayout.isPending}
                          className="gap-2"
                        >
                          <DollarSign className="h-4 w-4" />
                          Process payout
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(payout.order_id);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success opacity-50" />
                <p className="font-medium text-success">All payouts processed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No pending payouts at this time
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Payout Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={() => setSelectedOrderId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payout details</DialogTitle>
          </DialogHeader>
          {selectedOrderId && (
            <PayoutDetailView
              orderId={selectedOrderId}
              onClose={() => setSelectedOrderId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
