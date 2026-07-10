import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Calendar,
  DollarSign,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { ForecastingEngine } from "@/services/ForecastingEngine";
import { toast } from "sonner";

interface CashFlowPredictionProps {
  months?: number;
  method?: "linear" | "seasonal";
}

export function CashFlowPrediction({ months = 6, method = "seasonal" }: CashFlowPredictionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const generateForecast = async () => {
    setIsLoading(true);
    try {
      const forecastId = await ForecastingEngine.predictCashFlow(months, method);
      const { forecast, alerts: forecastAlerts } = await ForecastingEngine.getCashFlowForecastWithAlerts(
        forecastId
      );

      setForecastData(forecast);
      setAlerts(forecastAlerts);

      // Prepare chart data
      const predictions = forecast.predictions as Record<string, number>;
      const confidenceIntervals = forecast.confidence_intervals as Record<string, { lower: number; upper: number }>;

      const data = Object.entries(predictions).map(([date, value]) => ({
        month: new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        predicted: Math.round(value),
        lower: Math.round(confidenceIntervals[date]?.lower || value * 0.8),
        upper: Math.round(confidenceIntervals[date]?.upper || value * 1.2),
      }));

      setChartData(data);
      toast.success("Cash flow forecast generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate forecast");
      console.error("Forecast error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateForecast();
  }, [months, method]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-destructive/10 text-destructive border-destructive";
      case "high":
        return "bg-priority-high/10 text-priority-high border-priority-high";
      case "medium":
        return "bg-priority-medium/10 text-priority-medium border-priority-medium";
      default:
        return "bg-priority-low/10 text-priority-low border-priority-low";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (isLoading && !forecastData) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Cash flow prediction
              </CardTitle>
              <CardDescription>
                {months}-month forecast using {method} method
              </CardDescription>
            </div>
            <Button onClick={generateForecast} disabled={isLoading} size="sm" variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          {alerts.map((alert, index) => (
            <Alert key={index} className={getSeverityColor(alert.severity)}>
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs font-medium">{alert.month}</span>
                    <Badge variant="outline" className="text-xs">
                      {alert.alert_type}
                    </Badge>
                  </div>
                  <AlertDescription>{alert.message}</AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </motion.div>
      )}

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predicted cash position</CardTitle>
            <CardDescription>Forecast with confidence intervals</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`PKR ${value.toLocaleString()}`, ""]}
                />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <ReferenceLine y={50000} stroke="hsl(var(--warning))" strokeDasharray="3 3" label="Critical" />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  name="Upper bound"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                  name="Lower bound"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  name="Predicted"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recommendations */}
      {forecastData?.recommendations && forecastData.recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {forecastData.recommendations.map((rec: string, index: number) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span>{rec}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Trend Badge */}
      {forecastData?.trend_direction && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {forecastData.trend_direction === "increasing" ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : forecastData.trend_direction === "decreasing" ? (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  ) : (
                    <div className="w-5 h-5 text-muted-foreground">→</div>
                  )}
                  <span className="text-sm font-medium">
                    Trend: {forecastData.trend_direction}
                  </span>
                </div>
                {forecastData.seasonality_detected && (
                  <Badge variant="outline">Seasonal pattern detected</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
