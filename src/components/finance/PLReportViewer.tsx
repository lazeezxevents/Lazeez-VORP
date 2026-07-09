import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Download, Calendar, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PLStatement } from "@/services/ProfitLossManager";

interface PLReportViewerProps {
  statement: PLStatement;
  comparison?: PLStatement;
  isLoading?: boolean;
}

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

export const PLReportViewer = ({ statement, comparison, isLoading }: PLReportViewerProps) => {
  const [showComparison, setShowComparison] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 20) return "text-success";
    if (margin >= 10) return "text-warning";
    return "text-destructive";
  };

  // Prepare chart data
  const chartData = [
    {
      name: "Revenue",
      amount: statement.revenue.total,
    },
    {
      name: "COGS",
      amount: statement.expenses.cogs,
    },
    {
      name: "Operating Exp",
      amount: statement.expenses.operating_expenses.total,
    },
    {
      name: "Net Income",
      amount: statement.net_income,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with key metrics */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Net Income */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net income</p>
                  <p className="text-2xl font-bold">{formatCurrency(statement.net_income)}</p>
                  <Badge
                    variant="outline"
                    className={`mt-2 ${statement.net_income >= 0 ? "border-success text-success" : "border-destructive text-destructive"}`}
                  >
                    {statement.net_margin.toFixed(2)}% margin
                  </Badge>
                </div>
                <div className={`p-3 rounded-lg ${statement.net_income >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                  {statement.net_income >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-success" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(statement.revenue.total)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Period: {new Date(statement.period_start).toLocaleDateString()} -{" "}
                    {new Date(statement.period_end).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expenses */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total expenses</p>
                  <p className="text-2xl font-bold">{formatCurrency(statement.expenses.total)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {((statement.expenses.total / statement.revenue.total) * 100).toFixed(1)}% of revenue
                  </p>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Change period
          </Button>
          {comparison && (
            <Button
              variant={showComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Compare periods
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Financial overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & loss statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Revenue Section */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Revenue</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subscription revenue</span>
                <span className="font-medium">{formatCurrency(statement.revenue.subscription)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Commission revenue</span>
                <span className="font-medium">{formatCurrency(statement.revenue.commission)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fee revenue</span>
                <span className="font-medium">{formatCurrency(statement.revenue.fees)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Other revenue</span>
                <span className="font-medium">{formatCurrency(statement.revenue.other)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Total revenue</span>
                <span>{formatCurrency(statement.revenue.total)}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Expenses Section */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Expenses</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cost of goods sold</span>
                <span className="font-medium">{formatCurrency(statement.expenses.cogs)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold text-success">
                <span>Gross profit</span>
                <span>
                  {formatCurrency(statement.gross_profit)}
                  <span className={`ml-2 text-sm ${getMarginColor(statement.gross_margin)}`}>
                    ({statement.gross_margin.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <Separator className="my-4" />
              <div className="pl-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">Operating expenses</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Salaries</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.salaries)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rent</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.rent)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Utilities</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.utilities)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Marketing</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.marketing)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Technology</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.technology)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Other</span>
                  <span className="font-medium">{formatCurrency(statement.expenses.operating_expenses.other)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Total operating expenses</span>
                  <span>{formatCurrency(statement.expenses.operating_expenses.total)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold text-info">
                <span>Operating income</span>
                <span>
                  {formatCurrency(statement.operating_income)}
                  <span className={`ml-2 text-sm ${getMarginColor(statement.operating_margin)}`}>
                    ({statement.operating_margin.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Other expenses</span>
                <span className="font-medium">{formatCurrency(statement.expenses.other_expenses)}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Net Income */}
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Net income</span>
            <span className={statement.net_income >= 0 ? "text-success" : "text-destructive"}>
              {formatCurrency(statement.net_income)}
              <span className={`ml-2 text-sm ${getMarginColor(statement.net_margin)}`}>
                ({statement.net_margin.toFixed(1)}%)
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
