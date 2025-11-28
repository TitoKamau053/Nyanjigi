import React, { useState, useEffect } from 'react';
import { Droplets, CreditCard, FileText, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';

interface DashboardData {
  customer: {
    id: number;
    account_number: string;
    full_name: string;
    email: string;
    phone: string;
    location: string;
    status: string;
    connection_date: string;
    current_balance?: number;
  };
  recent_bills: Array<{
    id: number;
    bill_number?: string;
    billing_period_start?: string;
    billing_period_end?: string;
    total_amount?: number;
    due_date: string;
    status: string;
  }>;
  recent_payments: Array<{
    id: number;
    amount: number;
    payment_method: string;
    transaction_id: string;
    created_at: string;
    status: string;
  }>;
  usage_stats?: {
    this_month: number;
    last_month: number;
    average_monthly: number;
  };
}

const CustomerDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await customerService.getDashboard();
      console.log('Dashboard API response data:', response.data.data);
      setDashboardData(response.data.data || response.data);
    } catch {
      addToast('Failed to fetch dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">Please try refreshing the page.</p>
      </div>
    );
  }

  const { customer, recent_bills, recent_payments, usage_stats } = dashboardData;

  // Defensive checks for usage_stats and customer.status
  const safeUsageStats = usage_stats || { this_month: 0, last_month: 0, average_monthly: 0 };
  const safeCustomerStatus = customer?.status || 'inactive';

  // Use current_balance from customer.current_balance or fallback to 0
  const displayCurrentBalance = customer.current_balance ?? 0;

  // Defensive date parsing for connection_date
  let connectionDateStr = 'N/A';
  if (customer.connection_date) {
    const dateObj = new Date(customer.connection_date);
    if (!isNaN(dateObj.getTime())) {
      connectionDateStr = dateObj.toLocaleDateString();
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Droplets className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {customer.full_name}!</h1>
            <p className="text-blue-100">Account: {customer.account_number}</p>
            <p className="text-blue-100">Connected since {connectionDateStr}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              displayCurrentBalance > 0 ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <CreditCard className={`w-6 h-6 ${displayCurrentBalance > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className={`text-2xl font-bold ${displayCurrentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                KES {Math.abs(displayCurrentBalance).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                {displayCurrentBalance > 0 ? 'Amount Due' : 'Credit Balance'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Bills</p>
              <p className="text-2xl font-bold text-gray-900">
                {recent_bills.filter(b => b.status === 'pending').length}
              </p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">This Month Usage</p>
              <p className="text-2xl font-bold text-gray-900">{safeUsageStats.this_month}</p>
              <p className="text-xs text-gray-500">Cubic meters</p>
            </div>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Account Status</p>
              <p className={`text-lg font-bold ${safeCustomerStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {safeCustomerStatus.toUpperCase()}
              </p>
              <p className="text-xs text-gray-500">Service status</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
          <div className="px-6 py-4 border-b border-white/30">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Recent Bills
            </h3>
          </div>
          <div className="p-6">
            {recent_bills.length > 0 ? (
              <div className="space-y-4">
                {recent_bills.slice(0, 3).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 bg-white/30 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {bill.bill_number ? bill.bill_number : (bill.billing_period_start && bill.billing_period_end) ? `${new Date(bill.billing_period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${new Date(bill.billing_period_end).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Due: {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">KES {(bill.total_amount ?? 0).toLocaleString()}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                        bill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent bills</p>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
          <div className="px-6 py-4 border-b border-white/30">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Recent Payments
            </h3>
          </div>
          <div className="p-6">
            {recent_payments.length > 0 ? (
              <div className="space-y-4">
                {recent_payments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-white/30 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {payment.payment_method ? payment.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 font-mono">
                        {payment.transaction_id ?? 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">KES {(payment.amount ?? 0).toLocaleString()}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent payments</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage Chart Placeholder */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="px-6 py-4 border-b border-white/30">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Water Usage Trend
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{safeUsageStats.this_month}</p>
              <p className="text-sm text-gray-600">This Month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{safeUsageStats.last_month}</p>
              <p className="text-sm text-gray-600">Last Month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{safeUsageStats.average_monthly}</p>
              <p className="text-sm text-gray-600">Monthly Average</p>
            </div>
          </div>
          <div className="h-32 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-600">Usage chart will be displayed here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;