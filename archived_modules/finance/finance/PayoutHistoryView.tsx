import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  CheckCircle,
  Building2,
  Calendar,
  DollarSign,
  Eye,
  Receipt,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayoutHistory } from "./useVendorPayouts";
import { PayoutDetailView } from "./PayoutDetailView";
import type { VendorPayout } from "./useVendorPayouts";

/**
 * Payout History View
 * 
 * Displays completed payouts with:
 * - Filterable table of completed payouts
 * - Vendor filter
 * - Payout details on click
 * - Staggered entry animations
 * 
 * Requirements: 6.5
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

export function PayoutHistoryView() {
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: payouts, isLoading } = usePayoutHistory(selectedVendorId);

  // Get unique vendors for filter
  const vendors = payouts
    ? Array.from(new Set(payouts.map((p) => ({ id: p.vendor_id, name: p.vendor_name }))))
        .reduce((acc, vendor) => {
          if (!acc.find((v) => v.id === vendor.id)) {
            acc.push(vendor);
          }
          return acc;
        }, [] as Array<{ id: string; name: string }>)
    : [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!payouts || payouts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium text-lg">No payout history</p>
        <p className="text-sm mt-2">
          {selectedVendorId
            ? "No completed payouts for this vendor"
            : "Completed payouts will appear here"}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-4"
      >
        {/* Filter Bar */}
        <motion.div variants={itemVariants} className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by vendor:</span>
          </div>
          <Select
            value={selectedVendorId || "all"}
            onValueChange={(value) => setSelectedVendorId(value === "all" ? undefined : value)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Badge variant="outline" className="text-xs">
            {payouts.length} completed payout{payouts.length !== 1 ? "s" : ""}
          </Badge>
        </motion.div>

        {/* Payouts Table */}
        <motion.div variants={itemVariants}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Completed date</TableHead>
                <TableHead className="text-right">Order amount</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <motion.tr
                  key={payout.id}
                  variants={itemVariants}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedOrderId(payout.order_id)}
                >
                  <TableCell className="font-medium">{payout.order_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {payout.vendor_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {payout.remaining_paid_at
                        ? format(new Date(payout.remaining_paid_at), "MMM dd, yyyy")
                        : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₨{payout.order_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    -₨{payout.commission_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    ₨{payout.net_payout.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-success/10 text-success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderId(payout.order_id);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>

        {/* Summary */}
        <motion.div variants={itemVariants} className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {payouts.length} completed payout{payouts.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total paid out</div>
              <div className="text-lg font-bold text-success">
                ₨{payouts.reduce((sum, p) => sum + p.net_payout, 0).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total commission</div>
              <div className="text-lg font-bold text-destructive">
                ₨{payouts.reduce((sum, p) => sum + p.commission_amount, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
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
