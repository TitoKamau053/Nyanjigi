import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, AlertCircle, TrendingUp, Users,
  ArrowUpRight, ArrowDownRight, Minus,
  Trophy, AlertTriangle, Receipt
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

// ---------------------------------------------------------------------------
// Types — mirror the GET /api/v1/admin/dashboard-comprehensive response
// ---------------------------------------------------------------------------

interface RevenueTrendPoint {
  period: string;
  label: string;
  totalAmount: number;
  transactionCount: number;
}

interface DistributionSlice {
  amount: number;
  percent: number;
}

interface TopPerformer {
  id: number;
  accountNumber: string;
  name: string;
  zone: string;
  paymentCount: number;
  totalPaid: number;
}

interface PoorPerformer {
  id: number;
  accountNumber: string;
  name: string;
  zone: string;
  outstandingBills: number;
  outstandingFines: number;
  outstandingContributions: number;
  totalDebt: number;
}

interface RecentTransaction {
  id: string;
  transactionId: string;
  customer: string;
  account: string;
  amount: number;
  method: string;
  status: string;
  date: string;
}

interface ComprehensiveDashboardData {
  metrics: {
    totalRevenue: number;
    revenueGrowth: number | null;
    revenueGrowthLabel: string | null;
    outstandingBills: number;
    pendingContributions: number;
    activeCustomers: number;
  };
  systemHealth: {
    collectionRate: number | null;
    totalOutstanding: number;
    totalBilled: number;
    totalCollected: number;
  };
  trendWindow: {
    anchorDate: string;
    isCurrent: boolean;
  };
  revenueTrend: RevenueTrendPoint[];
  distribution: {
    bills: DistributionSlice;
    contributions: DistributionSlice;
    fines: DistributionSlice;
    advance: DistributionSlice;
  };
  topPerformers: TopPerformer[];
  poorPerformers: PoorPerformer[];
  recentTransactions: RecentTransaction[];
}

type Period = '7d' | '30d' | '90d' | 'yearly';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount: number) =>
  `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatCurrencyCompact = (amount: number) => {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(1)}K`;
  return `KES ${amount.toFixed(0)}`;
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Distribution slice colors — sky blue leads as the brand accent, with
// supporting hues that stay readable against it
const DISTRIBUTION_COLORS = {
  bills: '#0284c7',         // sky-600 — primary accent, matches brand
  contributions: '#0d9488', // teal-600
  fines: '#f59e0b',         // amber-500
  advance: '#cbd5e1'        // slate-300
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
  reversed: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<ComprehensiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const { addToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await adminService.getDashboardComprehensive(period);
        if (isMounted && response.data?.success) {
          setData(response.data.data);
        }
      } catch (err) {
        if (isMounted) addToast('Failed to load dashboard metrics', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [period, addToast]);

  const distributionChartData = useMemo(() => {
    if (!data) return [];
    const { distribution } = data;
    return [
      { name: 'Bills', value: distribution.bills.amount, percent: distribution.bills.percent, color: DISTRIBUTION_COLORS.bills },
      { name: 'Contributions', value: distribution.contributions.amount, percent: distribution.contributions.percent, color: DISTRIBUTION_COLORS.contributions },
      { name: 'Fines', value: distribution.fines.amount, percent: distribution.fines.percent, color: DISTRIBUTION_COLORS.fines },
      { name: 'Advance', value: distribution.advance.amount, percent: distribution.advance.percent, color: DISTRIBUTION_COLORS.advance }
    ].filter(slice => slice.value > 0);
  }, [data]);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <DashboardEmptyState />;

  const { metrics, systemHealth, trendWindow, revenueTrend, topPerformers, poorPerformers, recentTransactions } = data;

  return (
    <div className="space-y-6 pb-8">
      {/* Header / period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of collections, balances, and recent activity</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          icon={<Wallet className="w-4 h-4" />}
          trend={metrics.revenueGrowth}
          trendLabel={metrics.revenueGrowthLabel}
          tooltip="Completed payments collected so far this calendar month"
        />
        <KPICard
          title="Outstanding Bills"
          value={formatCurrency(metrics.outstandingBills)}
          icon={<AlertCircle className="w-4 h-4" />}
          tooltip="Sum of unpaid, overdue, and partially-paid bills across all customers"
        />
        <KPICard
          title="Pending Contributions"
          value={formatCurrency(metrics.pendingContributions)}
          icon={<TrendingUp className="w-4 h-4" />}
          tooltip="Required contribution amounts not yet fully paid"
        />
        <KPICard
          title="Active Customers"
          value={metrics.activeCustomers.toLocaleString()}
          icon={<Users className="w-4 h-4" />}
          tooltip="Customers currently marked active on the network"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Revenue Trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {trendWindow.isCurrent
                  ? 'Completed payments over time'
                  : `Showing most recent activity, ending ${new Date(trendWindow.anchorDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
            </div>
            {systemHealth.collectionRate !== null && (
              <div
                className="text-right bg-sky-50 rounded-lg px-3 py-1.5"
                title="Total collected divided by total billed, across all-time records"
              >
                <p className="text-[10px] uppercase tracking-wide text-sky-600/80">Collection rate</p>
                <p className="text-sm font-semibold text-sky-700">{systemHealth.collectionRate}%</p>
              </div>
            )}
          </div>
          <div className="h-64">
            {revenueTrend.length === 0 ? (
              <EmptyChartState message="No completed payments recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0f2fe" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e0f2fe' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCurrencyCompact}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value) || 0), 'Revenue']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e0f2fe', boxShadow: '0 4px 12px -2px rgba(2,132,199,0.12)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalAmount"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distribution donut */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Payment Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">Where collected funds were allocated</p>
          <div className="h-44 relative">
            {distributionChartData.length === 0 ? (
              <EmptyChartState message="No allocations recorded yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {distributionChartData.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(Number(value) || 0), String(name)]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e0f2fe', boxShadow: '0 4px 12px -2px rgba(2,132,199,0.12)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrencyCompact(distributionChartData.reduce((s, d) => s + d.value, 0))}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {distributionChartData.map((slice) => (
              <div key={slice.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.name}
                </span>
                <span className="text-slate-900 font-medium">{slice.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformersCard
          title="Top Performers"
          subtitle="Highest cumulative payments received"
          icon={<Trophy className="w-4 h-4 text-emerald-600" />}
          emptyMessage="No completed payments to rank yet"
        >
          {topPerformers.map((p, idx) => (
            <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-sky-50/40 transition-colors">
              <td className="py-3 pl-1 pr-2 text-xs font-semibold text-sky-600/70 w-6">{idx + 1}</td>
              <td className="py-3 pr-3">
                <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]" title={p.name}>{p.name}</p>
                <p className="text-xs text-slate-500">{p.accountNumber} · {p.zone}</p>
              </td>
              <td className="py-3 pr-1 text-right">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.totalPaid)}</p>
                <p className="text-xs text-slate-500">{p.paymentCount} payment{p.paymentCount !== 1 ? 's' : ''}</p>
              </td>
            </tr>
          ))}
        </PerformersCard>

        <PerformersCard
          title="Poor Performers"
          subtitle="Highest outstanding balances"
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          emptyMessage="No outstanding balances — collections are current"
        >
          {poorPerformers.map((p, idx) => (
            <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-sky-50/40 transition-colors">
              <td className="py-3 pl-1 pr-2 text-xs font-semibold text-sky-600/70 w-6">{idx + 1}</td>
              <td className="py-3 pr-3">
                <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]" title={p.name}>{p.name}</p>
                <p className="text-xs text-slate-500">{p.accountNumber} · {p.zone}</p>
              </td>
              <td className="py-3 pr-1 text-right">
                <p className="text-sm font-semibold text-red-600">{formatCurrency(p.totalDebt)}</p>
                <p className="text-xs text-slate-500" title="Bills + fines + contributions owed">
                  Bills {formatCurrencyCompact(p.outstandingBills)}
                </p>
              </td>
            </tr>
          ))}
        </PerformersCard>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
            <Receipt className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Recent System Transactions</h2>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No transactions recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-sky-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Account</th>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Method</th>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 text-right">Amount</th>
                  <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{t.customer}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{t.account}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 capitalize">{t.method.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(t.date)}</td>
                    <td className="px-5 py-3 text-sm text-slate-900 text-right font-medium">{formatCurrency(t.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PeriodSelector: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({ value, onChange }) => {
  const options: { value: Period; label: string }[] = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: 'yearly', label: '1Y' }
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200/80 bg-white p-0.5 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const KPICard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number | null;
  trendLabel?: string | null;
  tooltip?: string;
}> = ({ title, value, icon, trend, trendLabel, tooltip }) => (
  <div
    className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-150"
    title={tooltip}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 bg-sky-50 rounded-lg text-sky-600">{icon}</div>
      {trend !== undefined && trend !== null ? (
        <span
          className={`flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0
              ? 'text-emerald-700 bg-emerald-50'
              : trend < 0
              ? 'text-red-700 bg-red-50'
              : 'text-slate-500 bg-slate-100'
          }`}
        >
          {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(trend)}%
        </span>
      ) : trendLabel ? (
        <span className="text-xs font-medium px-2 py-1 rounded-full text-slate-500 bg-slate-100">
          {trendLabel}
        </span>
      ) : null}
    </div>
    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</h3>
    <p className="text-xl font-semibold text-slate-900 mt-0.5">{value}</p>
  </div>
);

const PerformersCard: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  emptyMessage: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, emptyMessage, children }) => {
  const hasRows = React.Children.count(children) > 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        {icon}
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="px-5">
        {hasRows ? (
          <table className="w-full">
            <tbody>{children}</tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">{emptyMessage}</div>
        )}
      </div>
      <div className="h-2" />
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset capitalize ${
      STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.reversed
    }`}
  >
    {status}
  </span>
);

const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-full flex items-center justify-center text-sm text-slate-400 border border-dashed border-sky-100 bg-sky-50/30 rounded-lg">
    {message}
  </div>
);

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-8 w-48 bg-sky-100/70 rounded" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 bg-sky-50/80 rounded-xl border border-sky-100" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 h-80 bg-sky-50/80 rounded-xl border border-sky-100" />
      <div className="h-80 bg-sky-50/80 rounded-xl border border-sky-100" />
    </div>
  </div>
);

const DashboardEmptyState: React.FC = () => (
  <div className="py-16 text-center">
    <p className="text-sm text-slate-500">Couldn't load dashboard data. Try refreshing the page.</p>
  </div>
);

export default AdminDashboard;