import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, DollarSign, CreditCard } from "lucide-react";
import { useSchedulePayment } from "./usePaymentSchedule";

/**
 * Payment Schedule Form Component
 * 
 * Form to schedule a payment for a bill with:
 * - Bill selection dropdown
 * - Payment date picker (must be future date)
 * - Payment method selection
 * - Notes field
 * - Amount display (from bill)
 * 
 * Requirements: 8.3, 8.6
 * Task: 17.4 Implement payment scheduling
 */

// =====================================================
// VALIDATION SCHEMA
// =====================================================

const paymentScheduleSchema = z.object({
  bill_id: z.string().min(1, "Bill is required"),
  payment_date: z.string().refine((date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, "Payment date must be today or in the future"),
  payment_method: z.enum(["bank_transfer", "check", "wire", "cash", "online"]),
  notes: z.string().optional(),
});

type PaymentScheduleFormData = z.infer<typeof paymentScheduleSchema>;

// =====================================================
// PROPS
// =====================================================

interface PaymentScheduleFormProps {
  billId?: string;
  billNumber?: string;
  amount?: number;
  vendorName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// =====================================================
// COMPONENT
// =====================================================

export function PaymentScheduleForm({
  billId,
  billNumber,
  amount,
  vendorName,
  onSuccess,
  onCancel,
}: PaymentScheduleFormProps) {
  const schedulePayment = useSchedulePayment();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentScheduleFormData>({
    resolver: zodResolver(paymentScheduleSchema),
    defaultValues: {
      bill_id: billId || "",
      payment_method: "bank_transfer",
      notes: "",
    },
  });

  const selectedPaymentMethod = watch("payment_method");

  const onSubmit = async (data: PaymentScheduleFormData) => {
    await schedulePayment.mutateAsync({
      bill_id: data.bill_id,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      notes: data.notes,
    });

    if (onSuccess) {
      onSuccess();
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      {/* Bill Information Display */}
      {billNumber && vendorName && amount !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-lg bg-accent/50 border border-border"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Bill</div>
              <div className="font-semibold">{billNumber}</div>
              <div className="text-sm text-muted-foreground mt-1">{vendorName}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-2xl font-bold text-foreground">
                ₨{amount.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bill Selection (if not pre-filled) */}
      {!billId && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          <Label htmlFor="bill_id">Bill *</Label>
          <Input
            id="bill_id"
            placeholder="Enter bill ID or number"
            {...register("bill_id")}
            className={errors.bill_id ? "border-destructive" : ""}
          />
          {errors.bill_id && (
            <p className="text-sm text-destructive">{errors.bill_id.message}</p>
          )}
        </motion.div>
      )}

      {/* Payment Date */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <Label htmlFor="payment_date" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Payment date *
        </Label>
        <Input
          id="payment_date"
          type="date"
          min={today}
          {...register("payment_date")}
          className={errors.payment_date ? "border-destructive" : ""}
        />
        {errors.payment_date && (
          <p className="text-sm text-destructive">{errors.payment_date.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Payment will be scheduled for this date
        </p>
      </motion.div>

      {/* Payment Method */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <Label htmlFor="payment_method" className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment method *
        </Label>
        <Select
          value={selectedPaymentMethod}
          onValueChange={(value) => setValue("payment_method", value as any)}
        >
          <SelectTrigger className={errors.payment_method ? "border-destructive" : ""}>
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
            <SelectItem value="check">Check</SelectItem>
            <SelectItem value="wire">Wire transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="online">Online payment</SelectItem>
          </SelectContent>
        </Select>
        {errors.payment_method && (
          <p className="text-sm text-destructive">{errors.payment_method.message}</p>
        )}
      </motion.div>

      {/* Notes */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-2"
      >
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes about this payment..."
          rows={3}
          {...register("notes")}
        />
        <p className="text-xs text-muted-foreground">
          Optional notes for internal reference
        </p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-3 pt-4"
      >
        <Button
          type="submit"
          disabled={schedulePayment.isPending}
          className="flex-1 gap-2"
        >
          {schedulePayment.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Scheduling...
            </>
          ) : (
            <>
              <DollarSign className="h-4 w-4" />
              Schedule payment
            </>
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={schedulePayment.isPending}
          >
            Cancel
          </Button>
        )}
      </motion.div>
    </motion.form>
  );
}
