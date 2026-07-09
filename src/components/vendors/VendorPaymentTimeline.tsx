import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign, Clock, CheckCircle, AlertCircle,
  Calendar, TrendingUp, Plus, ChevronRight
} from "lucide-react";
import { useVendorPayments, useUpdatePayment, VendorPayment } from "@/hooks/useVendorPayments";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { VendorPaymentForm } from "./VendorPaymentForm";
import { useVendor } from "@/hooks/useVendors";

interface VendorPaymentTimelineProps {
  vendorId: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  upfront_paid: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  upfront_paid: "Upfront Paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function VendorPaymentTimeline({ vendorId }: VendorPaymentTimelineProps) {
  const { data: payments, isLoading } = useVendorPayments(vendorId);
  const { data: vendor } = useVendor(vendorId);
  const updatePayment = useUpdatePayment();
  const { isStaff } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<VendorPayment | null>(null);

  const handleMarkUpfrontPaid = async (payment: VendorPayment) => {
    await updatePayment.mutateAsync({
      id: payment.id,
      upfront_paid_at: new Date().toISOString(),
      payment_status: "upfront_paid",
    });
  };

  const handleReleaseRemaining = async (payment: VendorPayment) => {
    await updatePayment.mutateAsync({
      id: payment.id,
      remaining_released_at: new Date().toISOString(),
      payment_status: "completed",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      {isStaff && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Payment Record
          </Button>
        </div>
      )}

      {/* Payment Timeline */}
      {!payments || payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Payment Records</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking payments by adding a new record
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4 pr-4">
            {payments.map((payment) => (
              <Card key={payment.id} className="overflow-hidden">
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Order #{payment.order_id}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(statusColors[payment.payment_status])}>
                      {statusLabels[payment.payment_status] || payment.payment_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Financial Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Order Amount</p>
                      <p className="text-lg font-bold text-foreground">
                        Rs. {payment.order_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Commission</p>
                      <p className="text-lg font-bold text-warning">
                        Rs. {payment.commission_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        Upfront ({payment.upfront_percentage}%)
                      </p>
                      <p className="text-lg font-bold text-info">
                        Rs. {payment.upfront_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                      <p className="text-lg font-bold text-success">
                        Rs. {payment.remaining_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Payment Timeline Steps */}
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                    <div className="space-y-4">
                      {/* Order Created */}
                      <div className="relative flex gap-4">
                        <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-success border-2 border-success">
                          <CheckCircle className="w-4 h-4 text-success-foreground" />
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="font-medium text-foreground">Order Created</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>

                      {/* Upfront Payment */}
                      <div className="relative flex gap-4">
                        <div className={cn(
                          "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2",
                          payment.upfront_paid_at
                            ? "bg-success border-success"
                            : "bg-muted border-warning"
                        )}>
                          {payment.upfront_paid_at ? (
                            <CheckCircle className="w-4 h-4 text-success-foreground" />
                          ) : (
                            <Clock className="w-4 h-4 text-warning" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                Upfront Payment (Rs. {payment.upfront_amount.toLocaleString()})
                              </p>
                              {payment.upfront_paid_at ? (
                                <p className="text-sm text-muted-foreground">
                                  Paid on {format(new Date(payment.upfront_paid_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              ) : (
                                <p className="text-sm text-warning">Pending</p>
                              )}
                            </div>
                            {isStaff && !payment.upfront_paid_at && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkUpfrontPaid(payment)}
                                disabled={updatePayment.isPending}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Remaining Payment */}
                      <div className="relative flex gap-4">
                        <div className={cn(
                          "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2",
                          payment.remaining_released_at
                            ? "bg-success border-success"
                            : payment.upfront_paid_at
                              ? "bg-muted border-warning"
                              : "bg-muted border-muted-foreground"
                        )}>
                          {payment.remaining_released_at ? (
                            <CheckCircle className="w-4 h-4 text-success-foreground" />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                Remaining Amount (Rs. {payment.remaining_amount.toLocaleString()})
                              </p>
                              {payment.remaining_released_at ? (
                                <p className="text-sm text-muted-foreground">
                                  Released on {format(new Date(payment.remaining_released_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              ) : payment.upfront_paid_at ? (
                                <p className="text-sm text-warning">Waiting for release</p>
                              ) : (
                                <p className="text-sm text-muted-foreground">Pending upfront payment first</p>
                              )}
                            </div>
                            {isStaff && payment.upfront_paid_at && !payment.remaining_released_at && (
                              <Button
                                size="sm"
                                onClick={() => handleReleaseRemaining(payment)}
                                disabled={updatePayment.isPending}
                              >
                                Release Payment
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {payment.notes && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">{payment.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Payment Record</DialogTitle>
          </DialogHeader>
          <VendorPaymentForm
            vendorId={vendorId}
            commissionPercentage={vendor?.commission_percentage || 0}
            onSuccess={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
