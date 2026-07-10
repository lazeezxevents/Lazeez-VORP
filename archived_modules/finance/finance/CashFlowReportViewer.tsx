import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Download, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CashFlowStatement, CashPosition } from "@/services/CashFlowManager";

interface CashFlowReportViewerProps {
  statement: CashFlowStatement;
  position?: CashPosition;
  forecast?: Array<{ month: string; projected_cash: number }>;
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

export const CashFlowReportViewer = ({ statement, position, forecast, isLoading }: CashFlowReportViewerProps) => {
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

  const getAlertColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-destructive/10 text-destructive border-destructive";
      case "warning":
        return "bg-warning/10 text-warning border-warning";
      default:
        return "bg-success/10 text-success border-success";
    }
  };

  // Prepare chart data
  const chartData = forecast?.map((item) => ({
    month: new Date(item.month).toLocaleDateString("default", { month: "short", year: "numeric" }),
    cash: item.projected_cash,
  })) || [];

  // Add current position to chart
  if (position) {
    chartData.unshift({
      month: "Current",
      cash: position.current_cash,
    });
  }

  return (
    <div className="space-y-6">
      {/* Cash Position Alert */}
      {position && position.alert_level !== "safe" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={`border-2 ${getAlertColor(position.alert_level)}`}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {position.alert_level === "critical" ? "Critical cash position" : "Cash position warning"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current cash: {formatCurrency(position.current_cash)}
                    {position.runway_days && ` • ${position.runway_days} days of runway remaining`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Key Metrics */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Beginning Cash */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Beginning cash</p>
                  <p className="text-xl font-bold">{formatCurrency(statement.beginning_cash)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Net Cash Change */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net cash change</p>
                  <p className={`text-xl font-bold ${statement.net_cash_change >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(statement.net_cash_change)}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${statement.net_cash_change >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                  {statement.net_cash_change >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ending Cash */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ending cash</p>
                  <p className="text-xl font-bold">{formatCurrency(statement.ending_cash)}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Runway */}
        {position?.runway_days && (
          <motion.div variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cash runway</p>
                    <p className="text-xl font-bold">{position.runway_days} days</p>
                  </div>
                  <Badge className={getAlertColor(position.alert_level)} variant="outline">
                    {position.alert_level}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Cash Flow Forecast Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cash position trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cash"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Cash Position"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Cash Flow Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Cash flow statement</CardTitle>
          <p className="text-sm text-muted-foreground">
            Period: {new Date(statement.period_start).toLocaleDateString()} -{" "}
            {new Date(statement.period_end).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Operating Activities */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Operating activities</h3>
            <div className="space-y-2">
              {statement.operating_activities.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.description}</span>
                  <span className={`font-medium ${item.type === "inflow" ? "text-success" : "text-destructive"}`}>
                    {item.type === "inflow" ? "+" : "-"}
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total inflows</span>
                <span className="font-medium text-success">
                  {formatCurrency(statement.operating_activities.inflows)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total outflows</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(statement.operating_activities.outflows)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Net cash from operating</span>
                <span className={statement.operating_activities.net >= 0 ? "text-success" : "text-destructive"}>
                  {formatCurrency(statement.operating_activities.net)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Investing Activities */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Investing activities</h3>
            <div className="space-y-2">
              {statement.investing_activities.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.description}</span>
                  <span className={`font-medium ${item.type === "inflow" ? "text-success" : "text-destructive"}`}>
                    {item.type === "inflow" ? "+" : "-"}
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total inflows</span>
                <span className="font-medium text-success">
                  {formatCurrency(statement.investing_activities.inflows)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total outflows</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(statement.investing_activities.outflows)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Net cash from investing</span>
                <span className={statement.investing_activities.net >= 0 ? "text-success" : "text-destructive"}>
                  {formatCurrency(statement.investing_activities.net)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Financing Activities */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Financing activities</h3>
            <div className="space-y-2">
              {statement.financing_activities.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.description}</span>
                  <span className={`font-medium ${item.type === "inflow" ? "text-success" : "text-destructive"}`}>
                    {item.type === "inflow" ? "+" : "-"}
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total inflows</span>
                <span className="font-medium text-success">
                  {formatCurrency(statement.financing_activities.inflows)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total outflows</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(statement.financing_activities.outflows)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Net cash from financing</span>
                <span className={statement.financing_activities.net >= 0 ? "text-success" : "text-destructive"}>
                  {formatCurrency(statement.financing_activities.net)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Summary */}
          <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Beginning cash balance</span>
              <span className="font-medium">{formatCurrency(statement.beginning_cash)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Net cash change</span>
              <span className={`font-medium ${statement.net_cash_change >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(statement.net_cash_change)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Ending cash balance</span>
              <span className="text-primary">{formatCurrency(statement.ending_cash)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
