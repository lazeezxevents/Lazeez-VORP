import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreatePayment, useUpdatePayment, VendorPayment } from "@/hooks/useVendorPayments";

const paymentSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  order_amount: z.coerce.number().min(0, "Order amount must be positive"),
  commission_amount: z.coerce.number().min(0).optional(),
  upfront_amount: z.coerce.number().min(0).optional(),
  upfront_percentage: z.coerce.number().min(0).max(100).optional(),
  remaining_amount: z.coerce.number().min(0).optional(),
  payment_status: z.string(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface VendorPaymentFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  vendorId: string;
  payment?: VendorPayment | null;
  commissionPercentage?: number;
  onSuccess?: () => void;
}

const paymentStatuses = [
  { value: "pending", label: "Pending" },
  { value: "upfront_paid", label: "Upfront Paid" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function VendorPaymentForm({ 
  open = true, 
  onOpenChange, 
  vendorId, 
  payment,
  commissionPercentage = 0,
  onSuccess 
}: VendorPaymentFormProps) {
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const isEditing = !!payment;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      order_id: payment?.order_id || "",
      order_amount: payment?.order_amount || 0,
      commission_amount: payment?.commission_amount || 0,
      upfront_amount: payment?.upfront_amount || 0,
      upfront_percentage: payment?.upfront_percentage || 50,
      remaining_amount: payment?.remaining_amount || 0,
      payment_status: payment?.payment_status || "pending",
      notes: payment?.notes || "",
    },
  });

  // Auto-calculate fields when order amount changes
  const watchOrderAmount = form.watch("order_amount");
  const watchUpfrontPercentage = form.watch("upfront_percentage");

  const calculateAmounts = () => {
    const orderAmount = watchOrderAmount || 0;
    const upfrontPct = watchUpfrontPercentage || 50;
    const commission = orderAmount * (commissionPercentage / 100);
    const netAmount = orderAmount - commission;
    const upfront = netAmount * (upfrontPct / 100);
    const remaining = netAmount - upfront;

    form.setValue("commission_amount", Math.round(commission * 100) / 100);
    form.setValue("upfront_amount", Math.round(upfront * 100) / 100);
    form.setValue("remaining_amount", Math.round(remaining * 100) / 100);
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (isEditing && payment) {
      await updatePayment.mutateAsync({ id: payment.id, ...data });
    } else {
      await createPayment.mutateAsync({ 
        vendor_id: vendorId, 
        order_id: data.order_id,
        order_amount: data.order_amount,
        commission_amount: data.commission_amount,
        upfront_amount: data.upfront_amount,
        upfront_percentage: data.upfront_percentage,
        remaining_amount: data.remaining_amount,
        payment_status: data.payment_status,
        notes: data.notes,
      });
    }
    onOpenChange?.(false);
    form.reset();
    onSuccess?.();
  };

  const isLoading = createPayment.isPending || updatePayment.isPending;

  // Inline form mode (no dialog wrapper)
  if (!onOpenChange) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="order_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="ORD-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Amount *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0" 
                      {...field} 
                      onBlur={calculateAmounts}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="commission_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission ({commissionPercentage}%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled />
                  </FormControl>
                  <FormDescription>Auto-calculated</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="upfront_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upfront %</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="100" 
                      {...field}
                      onBlur={calculateAmounts}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="upfront_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upfront Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled />
                  </FormControl>
                  <FormDescription>To be paid on order</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remaining_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remaining Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled />
                  </FormControl>
                  <FormDescription>To be released later</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="payment_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paymentStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Any notes about this payment..."
                    className="min-h-[60px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Payment
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Payment" : "Add Payment Record"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="ORD-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Amount *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        onBlur={calculateAmounts}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="commission_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission ({commissionPercentage}%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} disabled />
                    </FormControl>
                    <FormDescription>Auto-calculated</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="upfront_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upfront %</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="100" 
                        {...field}
                        onBlur={calculateAmounts}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="upfront_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upfront Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} disabled />
                    </FormControl>
                    <FormDescription>To be paid on order</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remaining_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remaining Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} disabled />
                    </FormControl>
                    <FormDescription>To be released later</FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any notes about this payment..."
                      className="min-h-[60px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
