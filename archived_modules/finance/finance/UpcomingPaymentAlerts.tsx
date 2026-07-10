import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useUpcomingPayments, useLargePayments } from "./usePaymentSchedule";

/**
 * Upcoming Payment Alerts Component
 * 
 * Alert panel for upcoming payments with:
 * - Show payments due in next 7 days
 * - Highlight large payments (> ₨10,000)
 * - Total amount due this week
 * - Quick action buttons
 * 
 * Requirements: 8.6, 8.10
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
// COMPONENT
// =====================================================

export function UpcomingPaymentAlerts() {
  const { data: upcomingPayments, isLoading: isLoadingUpcoming } = useUpcomingPayments();
  const { data: largePayments, isLoading: isLoadingLarge } = useLargePayments();

  if (isLoadingUpcoming || isLoadingLarge) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalDueThisWeek = upcomingPayments?.reduce(
    (sum, payment) => sum + payment.amount,
    0
  ) || 0;

  const hasLargePayments = (largePayments?.length || 0) > 0;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-4"
    >
      {/* Summary Card */}
      <motion.div variants={itemVariants}>
        <Card className="hover-lift transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-info" />
              Upcoming payments (next 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                <div className="flex items-center gap-2 text-sm text-info mb-1">
                  <DollarSign className="h-4 w-4" />
                  Total due
                </div>
                <div className="text-2xl font-bold text-info">
                  ₨{totalDueThisWeek.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-accent border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Payments scheduled
                </div>
                <div className="text-2xl font-bold">
                  {upcomingPayments?.length || 0}
                </div>
              </div>

              {hasLargePayments && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 text-sm text-warning mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Large payments
                  </div>
                  <div className="text-2xl font-bold text-warning">
                    {largePayments?.length || 0}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Large Payments Alert */}
      {hasLargePayments && (
        <motion.div variants={itemVariants}>
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                Large payments requiring attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {largePayments?.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg border border-warning/20 bg-background hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{payment.vendor_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {payment.bill_number}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(payment.payment_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Amount</div>
                        <div className="text-xl font-bold text-warning">
                          ₨{payment.amount.toLocaleString()}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2">
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming Payments List */}
      {upcomingPayments && upcomingPayments.length > 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Payment schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingPayments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          payment.is_large_payment ? "bg-warning" : "bg-info"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{payment.vendor_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.bill_number}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </div>
                      <div className="font-semibold">
                        ₨{payment.amount.toLocaleString()}
                      </div>
                      {payment.is_large_payment && (
                        <Badge
                          variant="outline"
                          className="bg-warning/10 text-warning gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      )}
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
              <Calendar className="w-12 h-12 mx-auto mb-3 text-success opacity-50" />
              <p className="font-medium text-success">No upcoming payments</p>
              <p className="text-sm text-muted-foreground mt-1">
                All payments are up to date
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
