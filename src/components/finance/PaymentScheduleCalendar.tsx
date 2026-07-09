import { motion } from "framer-motion";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { useScheduledPayments, type ScheduledPayment } from "./usePaymentSchedule";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Payment Schedule Calendar Component
 * 
 * Calendar view of scheduled payments with:
 * - Monthly calendar with scheduled payments marked
 * - Color-coded by amount (large payments highlighted)
 * - Click date to see payments scheduled for that day
 * - Navigate between months
 * 
 * Requirements: 8.6
 * Task: 17.4 Implement payment scheduling
 */

// =====================================================
// TYPES
// =====================================================

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  payments: ScheduledPayment[];
  totalAmount: number;
  hasLargePayment: boolean;
}

// =====================================================
// ANIMATION VARIANTS
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
    },
  },
};

const dayVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getDaysInMonth(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: CalendarDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Add days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      payments: [],
      totalAmount: 0,
      hasLargePayment: false,
    });
  }

  // Add days from current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      payments: [],
      totalAmount: 0,
      hasLargePayment: false,
    });
  }

  // Add days from next month to complete the grid
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      payments: [],
      totalAmount: 0,
      hasLargePayment: false,
    });
  }

  return days;
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month];
}

// =====================================================
// COMPONENT
// =====================================================

export function PaymentScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch payments for current month
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data: payments, isLoading } = useScheduledPayments({
    start_date: startDate,
    end_date: endDate,
    status: 'scheduled',
  });

  // Build calendar days with payment data
  const calendarDays = getDaysInMonth(year, month);

  // Map payments to calendar days
  if (payments) {
    payments.forEach((payment) => {
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);

      const day = calendarDays.find(
        (d) => d.date.getTime() === paymentDate.getTime()
      );

      if (day) {
        day.payments.push(payment);
        day.totalAmount += payment.amount;
        if (payment.is_large_payment) {
          day.hasLargePayment = true;
        }
      }
    });
  }

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Payment calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="gap-2"
                >
                  Today
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToPreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[180px] text-center font-semibold">
                    {getMonthName(month)} {year}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day, index) => {
                const hasPayments = day.payments.length > 0;
                const isClickable = hasPayments && day.isCurrentMonth;

                return (
                  <motion.div
                    key={index}
                    variants={dayVariants}
                    whileHover={isClickable ? { scale: 1.05 } : {}}
                    className={`
                      relative min-h-[80px] p-2 rounded-lg border transition-all
                      ${day.isCurrentMonth ? "bg-background" : "bg-muted/30"}
                      ${day.isToday ? "border-info border-2" : "border-border"}
                      ${isClickable ? "cursor-pointer hover:bg-accent" : ""}
                      ${day.hasLargePayment ? "border-warning/50" : ""}
                    `}
                    onClick={() => isClickable && setSelectedDay(day)}
                  >
                    {/* Day Number */}
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${day.isCurrentMonth ? "text-foreground" : "text-muted-foreground"}
                        ${day.isToday ? "text-info font-bold" : ""}
                      `}
                    >
                      {day.date.getDate()}
                    </div>

                    {/* Payment Indicators */}
                    {hasPayments && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <div
                            className={`
                              w-2 h-2 rounded-full
                              ${day.hasLargePayment ? "bg-warning" : "bg-info"}
                            `}
                          />
                          <span className="text-xs text-muted-foreground">
                            {day.payments.length}
                          </span>
                        </div>
                        <div className="text-xs font-semibold">
                          ₨{day.totalAmount.toLocaleString()}
                        </div>
                        {day.hasLargePayment && (
                          <Badge
                            variant="outline"
                            className="bg-warning/10 text-warning text-[10px] px-1 py-0"
                          >
                            <AlertTriangle className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-info" />
                <span className="text-muted-foreground">Regular payment</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-muted-foreground">Large payment (&gt; ₨10,000)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded border-2 border-info" />
                <span className="text-muted-foreground">Today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Payments for {selectedDay?.date.toLocaleDateString()}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-lg bg-accent/50 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total payments</div>
                    <div className="text-2xl font-bold">
                      {selectedDay.payments.length}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total amount</div>
                    <div className="text-2xl font-bold">
                      ₨{selectedDay.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment List */}
              <div className="space-y-3">
                {selectedDay.payments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{payment.vendor_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {payment.bill_number}
                        </Badge>
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
                      <div className="text-sm text-muted-foreground mt-1 capitalize">
                        {payment.payment_method.replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        ₨{payment.amount.toLocaleString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
