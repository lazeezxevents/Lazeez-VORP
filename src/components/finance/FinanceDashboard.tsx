/**
 * Finance Dashboard
 * 
 * Executive dashboard with KPIs, charts, and real-time updates
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.10
 * Tasks: 59.1, 59.2, 59.3, 59.4, 59.5, 59.6, 59.7, 59.8
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Wallet,
  AlertTriangle,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

import { fraudPreventionService } from './FraudPreventionService';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// =====================================================
// Animation Variants
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 }
};

// =====================================================
// Types
// =====================================================

interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashPosition: number;
  mrr: number;
  arr: number;
  burnRate: number;
  runway: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface CashFlowData {
  month: string;
  actual: number;
  forecast: number;
}

interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  revenue: number;
  orders: number;
  commission: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface RevenueBySource {
  source: string;
  amount: number;
  percentage: number;
}

interface RegressionPoint {
  x: number;
  y: number;
  label: string;
}

interface MatrixData {
  category: string;
  subcategory: string;
  value: number;
  color: string;
}

interface AdvancedMetrics {
  grossMargin: number;
  operatingMargin: number;
  profitMargin: number;
  quickRatio: number;
  currentRatio: number;
  debtToEquity: number;
  returnOnAssets: number;
  returnOnEquity: number;
  workingCapital: number;
  operatingCashFlow: number;
}

interface AdvancedMetricOverrideRow {
  metric_key: string;
  // Postgres NUMERIC may come back as string depending on client configuration.
  metric_value: number | string;
}

interface MOUFinancialData {
  totalContractValue: number;
  activeMOUs: number;
  avgContractValue: number;
  mouCount: number;
}

// =====================================================
// Helper Functions
// =====================================================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatSignedCurrency = (amount: number | null | undefined) => {
  const num = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  if (num === 0) return formatCurrency(0);

  const sign = num < 0 ? '-' : '+';
  return `${sign} ${formatCurrency(Math.abs(num))}`;
};

const signedCurrencyTone = (amount: number | null | undefined) => {
  const num = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  if (num < 0) return 'text-destructive';
  if (num > 0) return 'text-success';
  return 'text-muted-foreground';
};

// Recharts/async metrics may temporarily return `undefined`/`null`.
// Centralize a safe `toFixed()` to prevent the whole dashboard from crashing.
const safeToFixed = (value: unknown, digits: number): string => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return num.toFixed(digits);
};

const formatPercentage = (value: unknown) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
};

// =====================================================
// KPI Card Component
// =====================================================

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  iconColor: string;
  isLoading?: boolean;
}

const KPICard = ({ title, value, change, icon: Icon, iconColor, isLoading }: KPICardProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const shouldShowChange = typeof change === 'number' && Number.isFinite(change);
  const isPositive = shouldShowChange && change >= 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div variants={itemVariants}>
      <Card className="hover-lift transition-all duration-300">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {shouldShowChange && (
                <div className="flex items-center gap-1">
                  <TrendIcon className={`w-4 h-4 ${isPositive ? 'text-success' : 'text-destructive'}`} />
                  <span className={`text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                    {formatPercentage(change)}
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-full ${iconColor}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// =====================================================
// Main Dashboard Component
// =====================================================

// Color palette for charts
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--info))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6'
];

export const FinanceDashboard = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isEditingAdvancedMetrics, setIsEditingAdvancedMetrics] = useState(false);
  const [advancedMetricsDraft, setAdvancedMetricsDraft] = useState<Record<string, string>>({});
  const [advancedMetricsSaving, setAdvancedMetricsSaving] = useState(false);

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['finance-dashboard-metrics', timeRange],
    queryFn: async () => {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Fetch transactions
      const { data: transactions } = await supabase
        .from('finance_transactions')
        .select('*')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      // Calculate metrics
      const revenue = transactions
        ?.filter(t => t.type === 'revenue')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      const expenses = transactions
        ?.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      // Get cash position (sum of all cash accounts)
      const { data: cashAccounts } = await supabase
        .from('finance_accounts')
        .select('balance')
        .eq('sub_type', 'cash')
        .eq('is_active', true);

      const cashPosition = cashAccounts
        ?.reduce((sum, acc) => sum + parseFloat(acc.balance), 0) || 0;

      // Calculate MRR (Monthly Recurring Revenue from subscriptions)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: subscriptionRevenue } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('type', 'revenue')
        .eq('source_module', 'subscription')
        .gte('transaction_date', thirtyDaysAgo.toISOString().split('T')[0]);

      const mrr = subscriptionRevenue
        ?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      const arr = mrr * 12;

      // Calculate burn rate (monthly expenses)
      // Normalize expenses to a monthly burn rate based on the selected period.
      // Also handle cases where `expense` amounts are stored as negative values.
      const periodDays =
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const monthlyBurnRate = Math.abs(expenses) * (30 / periodDays);

      // Calculate runway (months)
      // If burn rate is <= 0 or missing, runway isn't meaningful; show 0 instead of a placeholder.
      const runway = monthlyBurnRate > 0 && cashPosition > 0 ? cashPosition / monthlyBurnRate : 0;

      // Calculate growth (compare to previous period)
      const previousStartDate = new Date(startDate);
      const previousEndDate = new Date(startDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      previousStartDate.setDate(previousStartDate.getDate() - daysDiff);

      const { data: previousTransactions } = await supabase
        .from('finance_transactions')
        .select('*')
        .gte('transaction_date', previousStartDate.toISOString().split('T')[0])
        .lt('transaction_date', startDate.toISOString().split('T')[0]);

      const previousRevenue = previousTransactions
        ?.filter(t => t.type === 'revenue')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 1;

      const previousExpenses = previousTransactions
        ?.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 1;

      const revenueGrowth = ((revenue - previousRevenue) / previousRevenue) * 100;
      const expenseGrowth = ((expenses - previousExpenses) / previousExpenses) * 100;

      return {
        totalRevenue: revenue,
        totalExpenses: expenses,
        netIncome: revenue - expenses,
        cashPosition,
        mrr,
        arr,
        burnRate: monthlyBurnRate,
        runway,
        revenueGrowth,
        expenseGrowth
      } as DashboardMetrics;
    },
    refetchInterval: 60000 // Refetch every minute
  });

  // Fetch revenue trend data
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['finance-revenue-trend', timeRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: transactions } = await supabase
        .from('finance_transactions')
        .select('*')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true });

      // Group by date
      const grouped = transactions?.reduce((acc, t) => {
        const date = t.transaction_date;
        if (!acc[date]) {
          acc[date] = { revenue: 0, expenses: 0 };
        }
        if (t.type === 'revenue') {
          acc[date].revenue += parseFloat(t.amount);
        } else if (t.type === 'expense') {
          acc[date].expenses += parseFloat(t.amount);
        }
        return acc;
      }, {} as Record<string, { revenue: number; expenses: number }>);

      return Object.entries(grouped || {}).map(([date, data]) => ({
        date: format(new Date(date), 'MMM dd'),
        revenue: data.revenue,
        expenses: data.expenses,
        netIncome: data.revenue - data.expenses
      }));
    },
    refetchInterval: 60000
  });

  // Fetch MOU financial impact
  const { data: mouFinancialData, isLoading: mouFinancialLoading } = useQuery({
    queryKey: ['finance-mou-financial-impact'],
    queryFn: async () => {
      const { data: mous } = await supabase
        .from('mous')
        .select('*')
        .in('status', ['approved', 'signed']);

      const mouCount = mous?.length || 0;
      const activeMOUs = mouCount;

      const totalContractValue =
        mous?.reduce((sum, m: any) => {
          const raw =
            m?.contract_value ??
            m?.total_contract_value ??
            m?.value ??
            m?.contractValue ??
            0;
          const n = typeof raw === 'number' ? raw : parseFloat(raw);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0) || 0;

      const avgContractValue = mouCount > 0 ? totalContractValue / mouCount : 0;

      return {
        totalContractValue,
        activeMOUs,
        avgContractValue,
        mouCount
      } as MOUFinancialData;
    },
    refetchInterval: 300000
  });

  // Fetch cash flow forecast
  const { data: cashFlowData, isLoading: cashFlowLoading } = useQuery({
    queryKey: ['finance-cashflow-forecast'],
    queryFn: async () => {
      const data: CashFlowData[] = [];
      
      // Get last 6 months actual
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const { data: transactions } = await supabase
          .from('finance_transactions')
          .select('amount, type')
          .gte('transaction_date', start.toISOString().split('T')[0])
          .lte('transaction_date', end.toISOString().split('T')[0]);

        const netCash = transactions?.reduce((sum, t) => {
          return sum + (t.type === 'revenue' ? parseFloat(t.amount) : -parseFloat(t.amount));
        }, 0) || 0;

        data.push({
          month: format(date, 'MMM'),
          actual: netCash,
          forecast: 0
        });
      }

      // Add 3 months forecast (simple average)
      const avgCashFlow = data.reduce((sum, d) => sum + d.actual, 0) / data.length;
      for (let i = 1; i <= 3; i++) {
        const date = subMonths(new Date(), -i);
        data.push({
          month: format(date, 'MMM'),
          actual: 0,
          forecast: avgCashFlow
        });
      }

      return data;
    },
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  // Fetch expense breakdown by category
  const { data: expenseBreakdown, isLoading: expenseLoading } = useQuery({
    queryKey: ['finance-expense-breakdown', timeRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: expenses } = await supabase
        .from('finance_transactions')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      const grouped = expenses?.reduce((acc, exp) => {
        const cat = exp.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount);
        return acc;
      }, {} as Record<string, number>);

      const total = Object.values(grouped || {}).reduce((sum, val) => sum + val, 0);

      return Object.entries(grouped || {}).map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / total) * 100
      })) as ExpenseCategory[];
    },
    refetchInterval: 60000
  });

  // Fetch revenue by source
  const { data: revenueBySource, isLoading: revenueSourceLoading } = useQuery({
    queryKey: ['finance-revenue-source', timeRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: revenue } = await supabase
        .from('finance_transactions')
        .select('source_module, amount')
        .eq('type', 'revenue')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      const grouped = revenue?.reduce((acc, rev) => {
        const source = rev.source_module || 'Direct';
        acc[source] = (acc[source] || 0) + parseFloat(rev.amount);
        return acc;
      }, {} as Record<string, number>);

      const total = Object.values(grouped || {}).reduce((sum, val) => sum + val, 0);

      return Object.entries(grouped || {}).map(([source, amount]) => ({
        source,
        amount,
        percentage: (amount / total) * 100
      })) as RevenueBySource[];
    },
    refetchInterval: 60000
  });

  

  // Fetch vendor performance
  const { data: vendorPerformance, isLoading: vendorLoading } = useQuery({
    queryKey: ['finance-vendor-performance', timeRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Get vendor revenue from orders
      const { data: orders } = await supabase
        .from('orders')
        .select('vendor_id, total_amount, commission_amount, vendors(name)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'completed');

      const grouped = orders?.reduce((acc, order) => {
        const vendorId = order.vendor_id;
        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendorId,
            vendorName: order.vendors?.name || 'Unknown',
            revenue: 0,
            orders: 0,
            commission: 0
          };
        }
        acc[vendorId].revenue += parseFloat(order.total_amount || '0');
        acc[vendorId].orders += 1;
        acc[vendorId].commission += parseFloat(order.commission_amount || '0');
        return acc;
      }, {} as Record<string, VendorPerformance>);

      return Object.values(grouped || {}).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    },
    refetchInterval: 60000
  });

  // Calculate regression data for revenue prediction
  const { data: regressionData, isLoading: regressionLoading } = useQuery({
    queryKey: ['finance-regression-analysis'],
    queryFn: async () => {
      const months = 12;
      const data: RegressionPoint[] = [];
      
      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const { data: transactions } = await supabase
          .from('finance_transactions')
          .select('amount')
          .eq('type', 'revenue')
          .gte('transaction_date', start.toISOString().split('T')[0])
          .lte('transaction_date', end.toISOString().split('T')[0]);

        const revenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        data.push({
          x: months - i,
          y: revenue,
          label: format(date, 'MMM yyyy')
        });
      }

      return data;
    },
    refetchInterval: 300000
  });

  // Calculate advanced financial metrics
  const { data: advancedMetrics, isLoading: advancedLoading } = useQuery({
    queryKey: ['finance-advanced-metrics', timeRange],
    queryFn: async () => {
      // Get balance sheet data
      const { data: assets } = await supabase
        .from('finance_accounts')
        .select('balance')
        .eq('account_type', 'asset')
        .eq('is_active', true);

      const { data: liabilities } = await supabase
        .from('finance_accounts')
        .select('balance')
        .eq('account_type', 'liability')
        .eq('is_active', true);

      const { data: equity } = await supabase
        .from('finance_accounts')
        .select('balance')
        .eq('account_type', 'equity')
        .eq('is_active', true);

      const { data: currentAssets } = await supabase
        .from('finance_accounts')
        .select('balance, sub_type')
        .eq('account_type', 'asset')
        .in('sub_type', ['cash', 'accounts_receivable', 'inventory'])
        .eq('is_active', true);

      const { data: currentLiabilities } = await supabase
        .from('finance_accounts')
        .select('balance')
        .eq('account_type', 'liability')
        .eq('sub_type', 'accounts_payable')
        .eq('is_active', true);

      const totalAssets = assets?.reduce((sum, a) => sum + parseFloat(a.balance), 0) || 0;
      const totalLiabilities = liabilities?.reduce((sum, l) => sum + parseFloat(l.balance), 0) || 0;
      const totalEquity = equity?.reduce((sum, e) => sum + parseFloat(e.balance), 0) || 0;
      const totalCurrentAssets = currentAssets?.reduce((sum, a) => sum + parseFloat(a.balance), 0) || 0;
      const quickAssets =
        currentAssets?.reduce((sum, a: any) => {
          if (a?.sub_type === 'inventory') return sum;
          return sum + parseFloat(a?.balance);
        }, 0) || 0;

      const totalCurrentLiabilities =
        currentLiabilities?.reduce((sum, l) => sum + parseFloat(l.balance), 0) || 0;

      // Get P&L data for margins
      const lookbackDays =
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

      const { data: revenueData } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('type', 'revenue')
        .gte('transaction_date', lookbackDate.toISOString().split('T')[0]);

      const { data: cogsData } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('category', 'Cost of Goods Sold')
        .gte('transaction_date', lookbackDate.toISOString().split('T')[0]);

      const { data: opexData } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('type', 'expense')
        .neq('category', 'Cost of Goods Sold')
        .gte('transaction_date', lookbackDate.toISOString().split('T')[0]);

      const revenue = revenueData?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
      const cogs = cogsData?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
      const opex = opexData?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      const grossProfit = revenue - cogs;
      const operatingIncome = grossProfit - opex;
      const netIncome = operatingIncome;
      const totalExpenses = cogs + opex;

      return {
        grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        operatingMargin: revenue > 0 ? (operatingIncome / revenue) * 100 : 0,
        profitMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
        quickRatio: totalCurrentLiabilities > 0 ? quickAssets / totalCurrentLiabilities : 0,
        currentRatio: totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0,
        debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
        returnOnAssets: totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0,
        returnOnEquity: totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0,
        workingCapital: totalCurrentAssets - totalCurrentLiabilities,
        operatingCashFlow: revenue - totalExpenses
      } as AdvancedMetrics;
    },
    refetchInterval: 300000
  });

  // Fetch user overrides for advanced metrics tiles.
  const { data: advancedMetricOverrides, refetch: refetchAdvancedMetricOverrides } = useQuery({
    queryKey: ['finance-advanced-metrics-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_advanced_metrics_overrides')
        .select('metric_key, metric_value');
      if (error) throw error;
      return data as AdvancedMetricOverrideRow[] | null;
    },
    refetchInterval: 300000
  });

  const overridesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of advancedMetricOverrides ?? []) {
      const v = typeof row.metric_value === 'number' ? row.metric_value : parseFloat(row.metric_value);
      map.set(row.metric_key, Number.isFinite(v) ? v : 0);
    }
    return map;
  }, [advancedMetricOverrides]);

  const displayAdvancedMetrics = useMemo(() => {
    const get = (key: string, fallback?: number) => overridesMap.get(key) ?? fallback;
    return {
      grossMargin: get('grossMargin', advancedMetrics?.grossMargin),
      operatingMargin: get('operatingMargin', advancedMetrics?.operatingMargin),
      profitMargin: get('profitMargin', advancedMetrics?.profitMargin),
      currentRatio: get('currentRatio', advancedMetrics?.currentRatio),
      quickRatio: get('quickRatio', advancedMetrics?.quickRatio),
      debtToEquity: get('debtToEquity', advancedMetrics?.debtToEquity),
      workingCapital: get('workingCapital', advancedMetrics?.workingCapital),
      operatingCashFlow: get('operatingCashFlow', advancedMetrics?.operatingCashFlow)
    };
  }, [overridesMap, advancedMetrics]);

  const hasAdvancedOverrides = (advancedMetricOverrides?.length ?? 0) > 0;

  const advancedMetricKeys = [
    'grossMargin',
    'operatingMargin',
    'profitMargin',
    'currentRatio',
    'quickRatio',
    'debtToEquity',
    'workingCapital',
    'operatingCashFlow'
  ] as const;

  const startEditingAdvancedMetrics = () => {
    setAdvancedMetricsDraft({
      grossMargin: safeToFixed(displayAdvancedMetrics?.grossMargin, 1),
      operatingMargin: safeToFixed(displayAdvancedMetrics?.operatingMargin, 1),
      profitMargin: safeToFixed(displayAdvancedMetrics?.profitMargin, 1),
      currentRatio: safeToFixed(displayAdvancedMetrics?.currentRatio, 2),
      quickRatio: safeToFixed(displayAdvancedMetrics?.quickRatio, 2),
      debtToEquity: safeToFixed(displayAdvancedMetrics?.debtToEquity, 2),
      workingCapital: safeToFixed(displayAdvancedMetrics?.workingCapital, 0),
      operatingCashFlow: safeToFixed(displayAdvancedMetrics?.operatingCashFlow, 0)
    });
    setIsEditingAdvancedMetrics(true);
  };

  const saveAdvancedMetricsOverrides = async () => {
    try {
      setAdvancedMetricsSaving(true);

      const payload = advancedMetricKeys.map((metricKey) => {
        const raw = advancedMetricsDraft[metricKey] ?? '';
        const n = parseFloat(raw);
        return {
          metric_key: metricKey,
          metric_value: Number.isFinite(n) ? n : 0
        };
      });

      const { error } = await supabase
        .from('finance_advanced_metrics_overrides')
        .upsert(payload, { onConflict: 'metric_key' });

      if (error) throw error;
      await refetchAdvancedMetricOverrides();
      setIsEditingAdvancedMetrics(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save advanced metrics overrides', err);
    } finally {
      setAdvancedMetricsSaving(false);
    }
  };

  const resetAdvancedMetricsOverrides = async () => {
    try {
      setAdvancedMetricsSaving(true);

      const { error } = await supabase
        .from('finance_advanced_metrics_overrides')
        .delete()
        .in('metric_key', advancedMetricKeys as unknown as string[]);

      if (error) throw error;
      await refetchAdvancedMetricOverrides();
      setIsEditingAdvancedMetrics(false);
      setAdvancedMetricsDraft({});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to reset advanced metrics overrides', err);
    } finally {
      setAdvancedMetricsSaving(false);
    }
  };

  // Fraud alerts query
  const { data: fraudStats } = useQuery({
    queryKey: ['fraud-statistics'],
    queryFn: () => fraudPreventionService.getFraudStatistics(),
    refetchInterval: 30000
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finance dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time financial metrics and insights
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <motion.button
              key={range}
              onClick={() => setTimeRange(range)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '90d' ? '90 days' : '1 year'}
            </motion.button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <KPICard
          title="Total revenue"
          value={formatCurrency(metrics?.totalRevenue || 0)}
          change={metrics?.revenueGrowth}
          icon={TrendingUp}
          iconColor="bg-success/10 text-success"
          isLoading={metricsLoading}
        />
        <KPICard
          title="Total expenses"
          value={formatCurrency(metrics?.totalExpenses || 0)}
          change={metrics?.expenseGrowth}
          icon={CreditCard}
          iconColor="bg-destructive/10 text-destructive"
          isLoading={metricsLoading}
        />
        <KPICard
          title="Net income"
          value={formatCurrency(metrics?.netIncome || 0)}
          icon={DollarSign}
          iconColor="bg-primary/10 text-primary"
          isLoading={metricsLoading}
        />
        <KPICard
          title="Cash position"
          value={formatCurrency(metrics?.cashPosition || 0)}
          icon={Wallet}
          iconColor="bg-info/10 text-info"
          isLoading={metricsLoading}
        />
      </motion.div>

      {/* Secondary KPIs */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <KPICard
          title="MRR"
          value={formatCurrency(metrics?.mrr || 0)}
          icon={Calendar}
          iconColor="bg-success/10 text-success"
          isLoading={metricsLoading}
        />
        <KPICard
          title="ARR"
          value={formatCurrency(metrics?.arr || 0)}
          icon={TrendingUp}
          iconColor="bg-success/10 text-success"
          isLoading={metricsLoading}
        />
        <KPICard
          title="Burn rate"
          value={formatCurrency(metrics?.burnRate || 0)}
          icon={TrendingDown}
          iconColor="bg-warning/10 text-warning"
          isLoading={metricsLoading}
        />
        <KPICard
          title="Runway"
          value={`${Math.max(0, Math.floor(metrics?.runway ?? 0))} months`}
          icon={Calendar}
          iconColor="bg-info/10 text-info"
          isLoading={metricsLoading}
        />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Revenue trend</CardTitle>
            <CardDescription>Daily revenue, expenses, and net income</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stackId="2"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cash Flow Forecast Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Cash flow forecast</CardTitle>
            <CardDescription>Historical and projected cash flow</CardDescription>
          </CardHeader>
          <CardContent>
            {cashFlowLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="hsl(var(--info))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Expense breakdown</CardTitle>
            <CardDescription>Distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : expenseBreakdown && expenseBreakdown.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${safeToFixed(entry?.percentage, 0)}%`}
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {expenseBreakdown.slice(0, 5).map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.category}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No expense data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Source Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Revenue sources</CardTitle>
            <CardDescription>Income distribution by module</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueSourceLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : revenueBySource && revenueBySource.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={revenueBySource}
                      dataKey="amount"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${safeToFixed(entry?.percentage, 0)}%`}
                    >
                      {revenueBySource.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {revenueBySource.slice(0, 5).map((item, index) => (
                    <div key={item.source} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.source}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No revenue data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MOU Financial Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">MOU financial impact</CardTitle>
            <CardDescription>Contract value and agreements</CardDescription>
          </CardHeader>
          <CardContent>
            {mouFinancialLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : mouFinancialData ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                    <span className="text-sm text-muted-foreground">Total contract value</span>
                    <span className="text-lg font-bold">{formatCurrency(mouFinancialData.totalContractValue)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/5">
                    <span className="text-sm text-muted-foreground">Active MOUs</span>
                    <span className="text-lg font-bold">{mouFinancialData.activeMOUs}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-info/5">
                    <span className="text-sm text-muted-foreground">Avg contract value</span>
                    <span className="text-lg font-bold">{formatCurrency(mouFinancialData.avgContractValue)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5">
                    <span className="text-sm text-muted-foreground">Total agreements</span>
                    <span className="text-lg font-bold">{mouFinancialData.mouCount}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No MOU data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vendor Performance & Regression Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendor Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top vendor performance</CardTitle>
            <CardDescription>Revenue and commission by vendor</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : vendorPerformance && vendorPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={vendorPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="vendorName" type="category" width={100} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
                  <Bar dataKey="commission" fill="hsl(var(--success))" name="Commission" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No vendor data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Regression Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Revenue trend analysis</CardTitle>
            <CardDescription>
              {regressionData && `R² = ${safeToFixed(regressionData.r2, 3)} • ${regressionData.slope >= 0 ? 'Upward' : 'Downward'} trend`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {regressionLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : regressionData?.points?.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="x" name="Week" className="text-xs" />
                  <YAxis dataKey="y" name="Revenue" className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label: number) => `Week ${label + 1}`}
                  />
                  <Scatter name="Actual Revenue" data={regressionData.points ?? []} fill="hsl(var(--primary))" />
                  <Line
                    type="monotone"
                    dataKey={(point: RegressionPoint) => regressionData.slope * point.x + regressionData.intercept}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Trend Line"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Insufficient data for regression analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Financial Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">Advanced financial metrics</CardTitle>
              <CardDescription>Key financial ratios and performance indicators</CardDescription>
            </div>
            <div className="flex gap-2">
              {!isEditingAdvancedMetrics ? (
                <button
                  type="button"
                  onClick={startEditingAdvancedMetrics}
                  className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={advancedLoading && !hasAdvancedOverrides}
                >
                  Edit metrics
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={saveAdvancedMetricsOverrides}
                    className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={advancedMetricsSaving}
                  >
                    {advancedMetricsSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAdvancedMetricsOverrides}
                    className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={advancedMetricsSaving}
                  >
                    Reset to Auto
                  </button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {advancedLoading && !hasAdvancedOverrides ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Gross margin</p>
                {isEditingAdvancedMetrics ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      step={0.1}
                      className="w-24 text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                      value={advancedMetricsDraft.grossMargin ?? ''}
                      onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, grossMargin: e.target.value }))}
                    />
                    <span className="text-xl font-bold">%</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.grossMargin, 1)}%</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Operating margin</p>
                {isEditingAdvancedMetrics ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      step={0.1}
                      className="w-24 text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                      value={advancedMetricsDraft.operatingMargin ?? ''}
                      onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, operatingMargin: e.target.value }))}
                    />
                    <span className="text-xl font-bold">%</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.operatingMargin, 1)}%</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Profit margin</p>
                {isEditingAdvancedMetrics ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      step={0.1}
                      className="w-24 text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                      value={advancedMetricsDraft.profitMargin ?? ''}
                      onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, profitMargin: e.target.value }))}
                    />
                    <span className="text-xl font-bold">%</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.profitMargin, 1)}%</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current ratio</p>
                {isEditingAdvancedMetrics ? (
                  <input
                    type="number"
                    step={0.01}
                    className="w-full text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                    value={advancedMetricsDraft.currentRatio ?? ''}
                    onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, currentRatio: e.target.value }))}
                  />
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.currentRatio, 2)}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Quick ratio</p>
                {isEditingAdvancedMetrics ? (
                  <input
                    type="number"
                    step={0.01}
                    className="w-full text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                    value={advancedMetricsDraft.quickRatio ?? ''}
                    onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, quickRatio: e.target.value }))}
                  />
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.quickRatio, 2)}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Debt to equity</p>
                {isEditingAdvancedMetrics ? (
                  <input
                    type="number"
                    step={0.01}
                    className="w-full text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                    value={advancedMetricsDraft.debtToEquity ?? ''}
                    onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, debtToEquity: e.target.value }))}
                  />
                ) : (
                  <p className="text-xl font-bold">{safeToFixed(displayAdvancedMetrics?.debtToEquity, 2)}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Working capital</p>
                {isEditingAdvancedMetrics ? (
                  <>
                    <input
                      type="number"
                      step={1}
                      className="w-full text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                      value={advancedMetricsDraft.workingCapital ?? ''}
                      onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, workingCapital: e.target.value }))}
                    />
                    <p className={`text-xs ${signedCurrencyTone(parseFloat(advancedMetricsDraft.workingCapital ?? '0'))}`}>
                      {formatSignedCurrency(parseFloat(advancedMetricsDraft.workingCapital ?? '0'))}
                    </p>
                  </>
                ) : (
                  <p className={`text-xl font-bold ${signedCurrencyTone(displayAdvancedMetrics?.workingCapital)}`}>
                    {formatSignedCurrency(displayAdvancedMetrics?.workingCapital)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Operating cash flow</p>
                {isEditingAdvancedMetrics ? (
                  <>
                    <input
                      type="number"
                      step={1}
                      className="w-full text-right text-xl font-bold bg-secondary/20 rounded-md p-1"
                      value={advancedMetricsDraft.operatingCashFlow ?? ''}
                      onChange={(e) => setAdvancedMetricsDraft((prev) => ({ ...prev, operatingCashFlow: e.target.value }))}
                    />
                    <p className={`text-xs ${signedCurrencyTone(parseFloat(advancedMetricsDraft.operatingCashFlow ?? '0'))}`}>
                      {formatSignedCurrency(parseFloat(advancedMetricsDraft.operatingCashFlow ?? '0'))}
                    </p>
                  </>
                ) : (
                  <p className={`text-xl font-bold ${signedCurrencyTone(displayAdvancedMetrics?.operatingCashFlow)}`}>
                    {formatSignedCurrency(displayAdvancedMetrics?.operatingCashFlow)}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts Panel */}
      {fraudStats && (fraudStats.openAlerts > 0 || fraudStats.pendingApprovals > 0) && (
        <Card className="border-warning">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <CardTitle className="text-lg font-semibold">Financial alerts</CardTitle>
            </div>
            <CardDescription>Critical items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fraudStats.criticalAlerts > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">Critical fraud alerts</p>
                      <p className="text-xs text-muted-foreground">
                        {fraudStats.criticalAlerts} alert{fraudStats.criticalAlerts !== 1 ? 's' : ''} require immediate attention
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-destructive/10 text-destructive">
                    {fraudStats.criticalAlerts}
                  </Badge>
                </div>
              )}
              {fraudStats.pendingApprovals > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium">Pending approvals</p>
                      <p className="text-xs text-muted-foreground">
                        {fraudStats.pendingApprovals} transaction{fraudStats.pendingApprovals !== 1 ? 's' : ''} awaiting approval
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-warning/10 text-warning">
                    {fraudStats.pendingApprovals}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
