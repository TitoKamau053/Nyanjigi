/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  FileText, 
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [chartData, setChartData] = useState<any>(null);
  const { addToast } = useToast();

const generateFallbackChartData = useCallback(async () => {
  try {
    console.log('Generating chart data for timeRange:', timeRange);

    // Get real data from working endpoints
    const [dashboardResponse, billsResponse, paymentsResponse] = await Promise.all([
      adminService.getDashboard(),
      adminService.getBills({ limit: 1000 }),
      adminService.getPayments({ limit: 1000 })
    ]);

    const dashboardData = dashboardResponse.data.data || dashboardResponse.data;
    const billsData = billsResponse.data.data || billsResponse.data;
    const paymentsData = paymentsResponse.data.data || paymentsResponse.data;
    const bills = billsData.bills || [];
    const payments = paymentsData.payments || [];

    console.log('Dashboard data:', dashboardData);
    console.log('Bills data:', billsData);
    console.log('Payments data:', paymentsData);
    console.log('Number of bills:', bills.length);
    console.log('Number of payments:', payments.length);

    // Generate revenue data based on time range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const labels: string[] = [];
    const values: number[] = [];

    // Group payments by time period (use payments as revenue, not bills)
    const revenueByPeriod = new Map();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      let periodKey;
      if (timeRange === '7d') {
        periodKey = date.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (timeRange === '30d') {
        periodKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        periodKey = date.toLocaleDateString('en-US', { month: 'short' });
      }
      
      if (!labels.includes(periodKey)) {
        labels.push(periodKey);
      }
      revenueByPeriod.set(periodKey, 0);
    }

    // Process payments and group by time period
    payments.forEach((payment: any) => {
      if (payment.status === 'completed') {
        const paymentDate = new Date(payment.payment_date || payment.created_at);
        const paymentAmount = parseFloat(payment.amount || 0); // ← This parseFloat is critical!
        
        let periodKey;
        if (timeRange === '7d') {
          periodKey = paymentDate.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (timeRange === '30d') {
          periodKey = paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          periodKey = paymentDate.toLocaleDateString('en-US', { month: 'short' });
        }
        
        if (revenueByPeriod.has(periodKey)) {
          const currentAmount = revenueByPeriod.get(periodKey);
          revenueByPeriod.set(periodKey, currentAmount + paymentAmount); // ← Addition, not concatenation
        }
      }
    });

    // Generate values array
    labels.forEach(label => {
      const revenue = revenueByPeriod.get(label) || 0;
      values.push(Math.round(revenue));
    });

    console.log('Generated labels:', labels);
    console.log('Generated values:', values);

    // Calculate payment method distribution from actual payments
    const paymentMethods = {
      'Equity M-Pesa': 0,
      'Equity Branch': 0,
      'Equity Agent': 0,
      'Other': 0
    };

    payments.forEach((payment: any) => {
      if (payment.status === 'completed') {
        const method = payment.payment_method || '';
        if (method.includes('mpesa')) {
          paymentMethods['Equity M-Pesa']++;
        } else if (method.includes('branch')) {
          paymentMethods['Equity Branch']++;
        } else if (method.includes('agent')) {
          paymentMethods['Equity Agent']++;
        } else {
          paymentMethods['Other']++;
        }
      }
    });

    const totalPayments = Object.values(paymentMethods).reduce((sum, count) => sum + count, 0);
    const paymentMethodData = totalPayments > 0 
      ? Object.values(paymentMethods).map(count => Math.round((count / totalPayments) * 100))
      : [68, 18, 14, 0];

    return {
      revenue: { labels, data: values },
      financial: {
        paymentMethods: {
          labels: ['Equity M-Pesa', 'Equity Branch', 'Equity Agent', 'Other'],
          data: paymentMethodData
        }
      }
    };
  } catch (error) {
    console.error('Chart data generation error:', error);
    // Return basic sample data
    // const sampleData = {
    //   revenue: {
    //     labels: timeRange === '7d'
    //       ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    //       : timeRange === '30d'
    //       ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
    //       : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    //     data: timeRange === '7d'
    //       ? [45000, 52000, 48000, 61000, 55000, 67000, 43000]
    //       : timeRange === '30d'
    //       ? [180000, 195000, 210000, 225000]
    //       : [95000, 98000, 105000, 110000, 120000, 125000]
    //   },
    //   financial: {
    //     paymentMethods: {
    //       labels: ['Equity M-Pesa', 'Equity Branch', 'Equity Agent', 'Other'],
    //       data: [68, 18, 14, 0]
    //     }
    //   }
    // };

    // console.log('Using basic sample data:', sampleData);
    // return sampleData;
  }
}, [timeRange]);

const fetchDashboardData = useCallback(async () => {
  try {
    // Fetch dashboard data, bills, and payments
    const [dashboardResponse, billsResponse, paymentsResponse] = await Promise.all([
      adminService.getDashboard(),
      adminService.getBills({ limit: 1000 }),
      adminService.getPayments({ limit: 1000 })
    ]);

    const dashboardApiData = dashboardResponse.data.data || dashboardResponse.data;
    const billsApiData = billsResponse.data.data || billsResponse.data;
    const paymentsApiData = paymentsResponse.data.data || paymentsResponse.data;
    
    const bills = billsApiData.bills || [];
    const payments = paymentsApiData.payments || [];

    // Calculate total revenue from payments (actual money received)
    const totalRevenue = payments
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, payment: any) => {
        const amount = parseFloat(payment.amount || 0);
        return sum + amount;
      }, 0);

    // Calculate bill statistics
    const pendingBills = bills.filter((bill: any) => 
      bill.status === 'pending' || bill.status === 'overdue'
    ).length;
    
    const paidBills = bills.filter((bill: any) => bill.status === 'paid').length;
    const totalBills = bills.length;
    
    // Payment success rate = (paid bills / total bills) * 100
    const paymentSuccess = totalBills > 0 
      ? Math.round((paidBills / totalBills) * 100) 
      : 0;

    setDashboardData({
      totalCustomers: dashboardApiData.total_customers ?? dashboardApiData.totalCustomers ?? 0,
      totalRevenue: totalRevenue,
      pendingBills: pendingBills,
      paymentSuccess: paymentSuccess,
    });
  } catch (error) {
    addToast('Failed to fetch dashboard data', 'error');
  } finally {
    setLoading(false);
  }
}, [addToast]);

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true);

      // Try to fetch from backend first
      try {
        const [revenueResponse, financialResponse] = await Promise.all([
          adminService.getRevenueAnalytics(timeRange),
          adminService.getFinancialSummary(timeRange)
        ]);

        const revenueApiData = revenueResponse.data.data || revenueResponse.data;
        const financialData = financialResponse.data.data || financialResponse.data;

        // Debug logging to understand data structure
        console.log('Revenue API Response:', revenueResponse.data);
        console.log('Revenue Data:', revenueApiData);
        console.log('Financial API Response:', financialResponse.data);
        console.log('Financial Data:', financialData);

        setChartData({
          revenue: revenueApiData,
          financial: financialData
        });
        return; // If successful, exit early
      } catch (apiError) {
        console.warn('Backend API not available, using fallback data:', apiError);
      }

      // Fallback: Generate sample data based on existing bills and customers
      const fallbackData = await generateFallbackChartData();
      setChartData(fallbackData);

    } catch (error) {
      console.error('Chart data fetch error:', error);
      addToast('Using sample data - backend not available', 'warning');

      // Final fallback: Generate sample data
      const fallbackData = await generateFallbackChartData();
      setChartData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, [timeRange, addToast, generateFallbackChartData]);

  useEffect(() => {
    fetchDashboardData();
    fetchChartData();
  }, [fetchDashboardData, fetchChartData]);

  const statsCards = [
    {
      title: 'Total Customers',
      value: dashboardData?.totalCustomers?.toLocaleString() ?? '0',
      icon: Users,
      color: 'blue',
      change: '+8.2%',
      changeType: 'increase' as const
    },
    {
      title: 'Monthly Revenue',
      value: `KES ${((dashboardData?.totalRevenue ?? 0) / 1000).toFixed(0)}K`,
      icon: DollarSign,
      color: 'green',
      change: '+15.3%',
      changeType: 'increase' as const
    },
    {
      title: 'Pending Bills',
      value: dashboardData?.pendingBills?.toString() ?? '0',
      icon: FileText,
      color: 'yellow',
      change: '-2.1%',
      changeType: 'decrease' as const
    },
    {
      title: 'Payment Success',
      value: `${dashboardData?.paymentSuccess ?? 0}%`,
      icon: TrendingUp,
      color: 'cyan',
      change: '+1.2%',
      changeType: 'increase' as const
    }
  ];

  // Create chart data from the fetched/generated data
  const getChartData = () => {
    if (!chartData?.revenue) {
      return {
        labels: timeRange === '7d'
          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          : timeRange === '30d'
          ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Revenue (KES)',
            data: timeRange === '7d'
              ? [45000, 52000, 48000, 61000, 55000, 67000, 43000]
              : timeRange === '30d'
              ? [180000, 195000, 210000, 225000]
              : [95000, 98000, 105000, 110000, 120000, 125000],
            borderColor: '#0EA5E9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      };
    }

    const revenueData = chartData.revenue.data || [];

    return {
      labels: chartData.revenue.labels || ['No Data'],
      datasets: [
        {
          label: 'Revenue (KES)',
          data: revenueData.length > 0 ? revenueData : [0],
          borderColor: '#0EA5E9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0EA5E9',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const revenueData = getChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#0EA5E9',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `Revenue: KES ${value.toLocaleString()}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return `KES ${value.toLocaleString()}`;
          }
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Dashboard Overview</h1>
          <p className="text-blue-700">Monitor your water management system performance</p>
        </div>

        <div className="flex space-x-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                timeRange === range
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white/50 text-blue-700 hover:bg-white/70 backdrop-blur-sm'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statsCards.map((card: any) => (
          <div key={card.title} className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30 hover:bg-white/30 transition-all duration-300 shadow-lg hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-blue-900">{card.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-xs font-medium ${
                    card.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.change}
                  </span>
                  <span className="text-xs text-blue-600 ml-1">vs last month</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl bg-${card.color}-500/20`}>
                <card.icon className={`h-6 w-6 text-${card.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Revenue Chart */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-blue-900">Revenue Trend</h3>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-600">+12.5%</span>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="h-80">
              <Line data={revenueData} options={chartOptions} />
            </div>
          )}
        </div>
      </div>

      {/* System Health & Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* System Health */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
          <h3 className="text-xl font-semibold text-blue-900 mb-6">System Health</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-blue-700">Database Connection</span>
              </div>
              <span className="text-sm font-medium text-green-600">Healthy</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-blue-700">Payment Gateway</span>
              </div>
              <span className="text-sm font-medium text-green-600">Active</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-blue-700">API Services</span>
              </div>
              <span className="text-sm font-medium text-green-600">Running</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-blue-700">Backup Status</span>
              </div>
              <span className="text-sm font-medium text-yellow-600">Scheduled</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
          <h3 className="text-xl font-semibold text-blue-900 mb-6">Recent Activity</h3>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">Payment received from John Doe</p>
                <p className="text-xs text-blue-600">KES 300 • 2 minutes ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">New customer registered</p>
                <p className="text-xs text-blue-600">Mary Smith (NyWs-00156) • 15 minutes ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">Bill generation completed</p>
                <p className="text-xs text-blue-600">1,250 bills generated • 1 hour ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-cyan-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">System backup completed</p>
                <p className="text-xs text-blue-600">Daily backup • 2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;