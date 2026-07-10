import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, CheckCircle, DollarSign, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import type { Budget, BudgetAllocation } from "@/services/BudgetManager";

interface BudgetDashboardProps {
  budgets: Budget[];
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

export const BudgetDashboard = ({ budgets, isLoading }: BudgetDashboardProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 100) return "text-destructive";
    if (percent >= 90) return "text-warning";
    if (percent >= 75) return "text-info";
    return "text-success";
  };

  const getUtilizationBgColor = (percent: number) => {
    if (percent >= 100) return "bg-destructive";
    if (percent >= 90) return "bg-warning";
    if (percent >= 75) return "bg-info";
    return "bg-success";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success";
      case "draft":
        return "bg-muted text-muted-foreground";
      case "closed":
        return "bg-info/10 text-info";
      case "revised":
        return "bg-warning/10 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Calculate summary metrics
  const activeBudgets = budgets.filter((b) => b.status === "active");
  const totalBudget = activeBudgets.reduce((sum, b) => sum + b.total_amount, 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + b.spent_amount, 0);
  const totalRemaining = activeBudgets.reduce((sum, b) => sum + b.remaining_amount, 0);
  const avgUtilization = activeBudgets.length > 0
    ? activeBudgets.reduce((sum, b) => sum + b.utilization_percent, 0) / activeBudgets.length
    : 0;

  // Count budgets by alert level
  const criticalBudgets = activeBudgets.filter((b) => b.alert_threshold_100).length;
  const warningBudgets = activeBudgets.filter((b) => b.alert_threshold_90 && !b.alert_threshold_100).length;

  // Prepare chart data
  const chartData = activeBudgets.map((budget) => ({
    name: budget.name.length > 20 ? budget.name.substring(0, 20) + "..." : budget.name,
    allocated: budget.total_amount,
    spent: budget.spent_amount,
    remaining: budget.remaining_amount,
    utilization: budget.utilization_percent,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Total Budget */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total budget</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activeBudgets.length} active budgets</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Spent */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total spent</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                  <Badge variant="outline" className={getUtilizationColor(avgUtilization)}>
                    {avgUtilization.toFixed(1)}% avg utilization
                  </Badge>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Remaining */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRemaining)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((totalRemaining / totalBudget) * 100).toFixed(1)}% available
                  </p>
                </div>
                <div className="p-3 bg-success/10 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alerts */}
        <motion.div variants={itemVariants}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Budget alerts</p>
                  <p className="text-2xl font-bold">{criticalBudgets + warningBudgets}</p>
                  <div className="flex gap-2 mt-1">
                    {criticalBudgets > 0 && (
                      <Badge variant="outline" className="text-destructive border-destructive text-xs">
                        {criticalBudgets} critical
                      </Badge>
                    )}
                    {warningBudgets > 0 && (
                      <Badge variant="outline" className="text-warning border-warning text-xs">
                        {warningBudgets} warning
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${criticalBudgets > 0 ? "bg-destructive/10" : "bg-warning/10"}`}>
                  <AlertTriangle className={`w-6 h-6 ${criticalBudgets > 0 ? "text-destructive" : "text-warning"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Budget Comparison Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Budget vs actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="allocated" fill="hsl(var(--primary))" name="Allocated" />
                <Bar dataKey="spent" fill="hsl(var(--warning))" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Budget List */}
      <motion.div
        className="space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {budgets.map((budget) => (
          <motion.div key={budget.id} variants={itemVariants}>
            <Card className="hover-lift transition-all duration-300 cursor-pointer group">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{budget.name}</h3>
                        <Badge className={getStatusColor(budget.status)} variant="secondary">
                          {budget.status}
                        </Badge>
                        {budget.alert_threshold_100 && (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Exceeded
                          </Badge>
                        )}
                        {budget.alert_threshold_90 && !budget.alert_threshold_100 && (
                          <Badge variant="outline" className="text-warning border-warning">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Warning
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {budget.period} • FY {budget.fiscal_year} • {new Date(budget.start_date).toLocaleDateString()} -{" "}
                        {new Date(budget.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(budget.total_amount)}</p>
                      <p className="text-sm text-muted-foreground">Total budget</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Spent: {formatCurrency(budget.spent_amount)}
                      </span>
                      <span className={`font-medium ${getUtilizationColor(budget.utilization_percent)}`}>
                        {budget.utilization_percent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(budget.utilization_percent, 100)}
                      className="h-3"
                      indicatorClassName={getUtilizationBgColor(budget.utilization_percent)}
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Remaining: {formatCurrency(budget.remaining_amount)}
                      </span>
                      <span className="text-muted-foreground">
                        {((budget.remaining_amount / budget.total_amount) * 100).toFixed(1)}% available
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {budget.notes && (
                    <p className="text-sm text-muted-foreground italic">{budget.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {budgets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <PieChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No budgets found</p>
          <p className="text-sm">Create your first budget to start tracking spending</p>
        </div>
      )}
    </div>
  );
};
