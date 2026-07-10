import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Building2,
  DollarSign,
  TrendingDown,
  Percent,
  CheckCircle,
  Clock,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayoutDetail, useProcessPayout } from "./useVendorPayouts";

/**
 * Payout Detail View
 * 
 * Displays detailed breakdown of vendor payout including:
 * - Order amount and upfront payment
 * - Commission deduction
 * - Net payout calculation
 * - Payment status and history
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * Task: 17.3 Implement vendor payout processing UI
 */

interface PayoutDetailViewProps {
  orderId: string;
  onClose?: () => void;
}

const statusConfig = {
  pending: { color: "bg-warning/10 text-warning", label: "Pending", icon: Clock },
  processing: { color: "bg-info/10 text-info", label: "Processing", icon: AlertCircle },
  completed: { color: "bg-success/10 text-success", label: "Completed", icon: CheckCircle },
  failed: { color: "bg-destructive/10 text-destructive", label: "Failed", icon: AlertCircle },
};

export function PayoutDetailView({ orderId, onClose }: PayoutDetailViewProps) {
  const { data: payout, isLoading } = usePayoutDetail(orderId);
  const processPayout = useProcessPayout();

  const handleProcessPayout = async () => {
    if (!payout) return;

    if (confirm("Are you sure you want to process this payout? This action will create journal entries and update vendor balances.")) {
      await processPayout.mutateAsync({
        vendor_id: payout.vendor_id,
        order_id: payout.order_id,
      });
      onClose?.();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Payout not found</p>
        <p className="text-sm mt-2">The requested payout details could not be loaded</p>
      </div>
    );
  }

  const StatusIcon = statusConfig[payout.payout_status].icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold">Order #{payout.order_number}</h3>
            <Badge className={statusConfig[payout.payout_status].color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig[payout.payout_status].label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {format(new Date(payout.created_at), "MMM dd, yyyy 'at' h:mm a")}
          </p>
        </div>
        {payout.payout_status === "pending" && (
          <Button onClick={handleProcessPayout} disabled={processPayout.isPending}>
            <DollarSign className="w-4 h-4 mr-2" />
            Process payout
          </Button>
        )}
      </div>

      {/* Vendor Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Vendor information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-lg">{payout.vendor_name}</p>
          <p className="text-sm text-muted-foreground mt-1">Vendor ID: {payout.vendor_id}</p>
        </CardContent>
      </Card>

      {/* Payout Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Order Amount */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Order amount</p>
                <p className="text-xs text-muted-foreground">Total order value</p>
              </div>
            </div>
            <span className="text-xl font-bold">
              ₨{payout.order_amount.toLocaleString()}
            </span>
          </div>

          <Separator />

          {/* Upfront Payment */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-info/10">
                <DollarSign className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="font-medium">Upfront payment</p>
                <p className="text-xs text-muted-foreground">
                  {payout.upfront_percentage}% paid in advance
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-info">
                -₨{payout.upfront_amount.toLocaleString()}
              </span>
              {payout.upfront_paid && (
                <div className="flex items-center gap-1 text-xs text-success mt-1">
                  <CheckCircle className="w-3 h-3" />
                  Paid {payout.upfront_paid_at && format(new Date(payout.upfront_paid_at), "MMM dd")}
                </div>
              )}
            </div>
          </div>

          {/* Remaining Amount */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/10">
                <TrendingDown className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-medium">Remaining amount</p>
                <p className="text-xs text-muted-foreground">
                  After upfront deduction
                </p>
              </div>
            </div>
            <span className="text-lg font-semibold">
              ₨{payout.remaining_amount.toLocaleString()}
            </span>
          </div>

          <Separator />

          {/* Commission Deduction */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <Percent className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium">Commission deduction</p>
                <p className="text-xs text-muted-foreground">
                  {payout.commission_rate}% platform fee
                </p>
              </div>
            </div>
            <span className="text-lg font-semibold text-destructive">
              -₨{payout.commission_amount.toLocaleString()}
            </span>
          </div>

          <Separator className="my-4" />

          {/* Net Payout */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/20">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-lg">Net payout</p>
                <p className="text-xs text-muted-foreground">
                  Final amount to vendor
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-success">
              ₨{payout.net_payout.toLocaleString()}
            </span>
          </div>

          {/* Calculation Formula */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p className="font-medium mb-2">Calculation:</p>
            <p>Net Payout = Remaining Amount - Commission</p>
            <p className="mt-1">
              ₨{payout.net_payout.toLocaleString()} = ₨{payout.remaining_amount.toLocaleString()} - ₨{payout.commission_amount.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Status */}
      {payout.payout_status === "completed" && payout.remaining_paid_at && (
        <Card className="border-success bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-success">Payout completed</p>
                <p className="text-sm text-muted-foreground">
                  Processed on {format(new Date(payout.remaining_paid_at), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Alert */}
      {payout.payout_status === "pending" && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/10">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="font-semibold text-warning">Awaiting processing</p>
                <p className="text-sm text-muted-foreground">
                  This payout is pending and requires manual processing
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
