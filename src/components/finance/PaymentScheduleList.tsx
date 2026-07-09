import { motion } from "framer-motion";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  Filter,
  X,
  Edit,
  Ban,
  Eye,
  Building2,
} from "lucide-react";
import {
  useScheduledPayments,
  useCancelScheduledPayment,
  type PaymentScheduleFilters,
  type ScheduledPayment,
} from "./usePaymentSchedule";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Payment Schedule List Component
 * 
 * Table/list of scheduled payments with:
 * - Columns: Vendor, Bill #, Amount, Scheduled Date, Payment Method, Status, Actions
 * - Filters: Date range, vendor, amount range
 * - Sort by date, amount, vendor
 * - Actions: View details, Edit schedule, Cancel payment
 * - Alert badges for large payments (> ₨10,000)
 * 
 * Requirements: 8.3, 8.6, 8.10
 * Task: 17.4 Implement payment scheduling
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
// STATUS BADGE COMPONENT
// =====================================================

function StatusBadge({ status }: { status: ScheduledPayment["status"] }) {
  const config = {
    scheduled: { color: "bg-info/10 text-info", label: "Scheduled" },
    processing: { color: "bg-warning/10 text-warning", label: "Processing" },
    completed: { color: "bg-success/10 text-success", label: "Completed" },
    cancelled: { color: "bg-muted text-muted-foreground", label: "Cancelled" },
    failed: { color: "bg-destructive/10 text-destructive", label: "Failed" },
  };

  const { color, label } = config[status];

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  );
}

// =====================================================
// COMPONENT
// =====================================================

export function PaymentScheduleList() {
  const [filters, setFilters] = useState<PaymentScheduleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<ScheduledPayment | null>(null);
  
  const { data: payments, isLoading } = useScheduledPayments(filters);
  const cancelPayment = useCancelScheduledPayment();

  const handleCancelPayment = async (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Are you sure you want to cancel this scheduled payment?")) {
      await cancelPayment.mutateAsync(paymentId);
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
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
        {/* Filters Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Payment schedule
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? "Hide filters" : "Show filters"}
                </Button>
              </div>
            </CardHeader>

            {showFilters && (
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
                >
                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={filters.start_date || ""}
                      onChange={(e) =>
                        setFilters({ ...filters, start_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={filters.end_date || ""}
                      onChange={(e) =>
                        setFilters({ ...filters, end_date: e.target.value })
                      }
                    />
                  </div>

                  {/* Amount Range */}
                  <div className="space-y-2">
                    <Label htmlFor="min_amount">Min amount (₨)</Label>
                    <Input
                      id="min_amount"
                      type="number"
                      placeholder="0"
                      value={filters.min_amount || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          min_amount: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_amount">Max amount (₨)</Label>
                    <Input
                      id="max_amount"
                      type="number"
                      placeholder="No limit"
                      value={filters.max_amount || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          max_amount: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          status: value === "all" ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="gap-2 w-full"
                      >
                        <X className="h-4 w-4" />
                        Clear filters
                      </Button>
                    </div>
                  )}
                </motion.div>
              </CardContent>
            )}
          </Card>
        </motion.div>

        {/* Payments Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-0">
              {payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Bill #</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Scheduled date</TableHead>
                        <TableHead>Payment method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment, index) => (
                        <motion.tr
                          key={payment.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => setSelectedPayment(payment)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{payment.vendor_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {payment.bill_number}
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold">
                                ₨{payment.amount.toLocaleString()}
                              </span>
                              {payment.is_large_payment && (
                                <Badge
                                  variant="outline"
                                  className="bg-warning/10 text-warning gap-1"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Large
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {payment.payment_method.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={payment.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPayment(payment);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {payment.status === "scheduled" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Open edit dialog
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => handleCancelPayment(payment.id, e)}
                                    disabled={cancelPayment.isPending}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="font-medium text-muted-foreground">No scheduled payments</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveFilters
                      ? "Try adjusting your filters"
                      : "Schedule a payment to get started"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Payment Detail Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Vendor</div>
                  <div className="font-semibold">{selectedPayment.vendor_name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Bill number</div>
                  <div className="font-mono text-sm">{selectedPayment.bill_number}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="text-2xl font-bold">
                    ₨{selectedPayment.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment date</div>
                  <div className="font-semibold">
                    {new Date(selectedPayment.payment_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment method</div>
                  <div className="capitalize">
                    {selectedPayment.payment_method.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <StatusBadge status={selectedPayment.status} />
                </div>
              </div>
              {selectedPayment.notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    {selectedPayment.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
