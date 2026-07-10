import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  Send,
  FileText,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { accountsReceivableService } from "./AccountsReceivableService";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

/**
 * Accounts Receivable Dashboard
 * 
 * Displays AR overview with:
 * - Total receivables and aging breakdown
 * - Overdue invoices with alerts
 * - Aging visualization using Recharts
 * - Staggered entry animations
 * 
 * Requirements: 7.6
 * Task: 16.5 Build accounts receivable dashboard
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

export function AccountsReceivableDashboard() {
  const [agingReport, setAgingReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch aging report
  useEffect(() => {
    const fetchAgingReport = async () => {
      setIsLoading(true);
      const report = await accountsReceivableService.getAgingReport();
      setAgingReport(report);
      setIsLoading(false);
    };

    fetchAgingReport();
  }, []);

  // Prepare chart data
  const chartData = agingReport
    ? [
        { name: "Current", value: agingReport.current, color: "hsl(var(--success))" },
        { name: "1-30 days", value: agingReport.days30, color: "hsl(var(--info))" },
        { name: "31-60 days", value: agingReport.days60, color: "hsl(var(--warning))" },
        { name: "61-90 days", value: agingReport.days90, color: "hsl(var(--priority-high))" },
        { name: "90+ days", value: agingReport.over90, color: "hsl(var(--destructive))" },
      ]
    : [];

  // Get overdue invoices
  const overdueInvoices = agingReport?.breakdown.filter(
    (item: any) => item.days_overdue > 0
  ) || [];

  if (isLoading) {
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
                Total receivables
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₨{agingReport?.total.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {agingReport?.breakdown.length || 0} outstanding invoices
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ₨{agingReport?.current.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Not yet due
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue (1-60 days)
              </CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                ₨{((agingReport?.days30 || 0) + (agingReport?.days60 || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires follow-up
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300 border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Critical (60+ days)
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ₨{((agingReport?.days90 || 0) + (agingReport?.over90 || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Urgent action needed
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Aging Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Aging breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `₨${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`₨${value.toLocaleString()}`, "Amount"]}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Overdue invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueInvoices.slice(0, 10).map((invoice: any, index: number) => (
                  <motion.div
                    key={invoice.invoice_number}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.invoice_number}</span>
                        <Badge
                          variant="outline"
                          className={
                            invoice.aging_bucket === '90+'
                              ? 'border-destructive text-destructive'
                              : invoice.aging_bucket === '90'
                              ? 'border-priority-high text-priority-high'
                              : 'border-warning text-warning'
                          }
                        >
                          {invoice.days_overdue} days overdue
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {invoice.vendor_name} • Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">
                          ₨{invoice.amount_due.toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => accountsReceivableService.sendPaymentReminder(invoice.invoice_number)}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Remind
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {overdueInvoices.length > 10 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing 10 of {overdueInvoices.length} overdue invoices
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {overdueInvoices.length === 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-success opacity-50" />
              <p className="font-medium text-success">All invoices are current</p>
              <p className="text-sm text-muted-foreground mt-1">
                No overdue payments at this time
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
