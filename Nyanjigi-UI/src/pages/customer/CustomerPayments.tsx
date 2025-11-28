import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, CheckCircle, Clock, XCircle, Search, Filter, Download } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';

interface Payment {
  id: number;
  amount: string; 
  payment_method: string; 
  transaction_id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  bill_id?: number;
  bill_month?: string;
}

const CustomerPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { addToast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, [selectedYear]);

  const fetchPayments = async () => {
    try {
      const response = await customerService.getPayments({ year: selectedYear });
      setPayments(response.data.data?.payments || response.data.data || []);
    } catch (error) {
      addToast('Failed to fetch payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-gray-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodIcon = (method: string) => {
    if (method?.includes('equity')) {
      if (method.includes('mpesa')) return <Smartphone className="w-5 h-5 text-green-600" />;
      return <CreditCard className="w-5 h-5 text-blue-600" />;
    }
    
    switch (method) {
      case 'mpesa': return <Smartphone className="w-5 h-5 text-green-600" />;
      case 'cash': return <CreditCard className="w-5 h-5 text-blue-600" />;
      case 'bank_transfer': return <CreditCard className="w-5 h-5 text-purple-600" />;
      default: return <CreditCard className="w-5 h-5 text-gray-600" />;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payment.bill_month && payment.bill_month.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.payment_method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const completedAmount = payments.filter(p => p.status === 'completed').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Payments</h1>
          <p className="text-gray-600 mt-1">Track your payment history</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">KES {completedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">KES {pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">M-Pesa Payments</p>
              <p className="text-2xl font-bold text-gray-900">
                {payments.filter(p => p.payment_method === 'mpesa').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Methods</option>
              <option value="equity_mpesa">Equity M-Pesa</option>
              <option value="equity_branch">Equity Branch</option>
              <option value="equity_agent">Equity Agent</option>
              <option value="equity_equitel">Equitel</option>
            </select>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="px-6 py-4 border-b border-white/30 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Payment History for {selectedYear}</h3>
          <button className="text-blue-600 hover:text-blue-800 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        
        {filteredPayments.length > 0 ? (
          <div className="divide-y divide-white/30">
            {filteredPayments.map((payment) => (
              <div key={payment.id} className="p-6 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      {getMethodIcon(payment.payment_method)}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {payment.payment_method.replace('_', ' ').toUpperCase()} Payment
                      </h4>
                      <p className="text-sm text-gray-600 font-mono">
                        {payment.transaction_id}
                      </p>
                      {payment.bill_month && (
                        <p className="text-sm text-gray-600">
                          For: {new Date(payment.bill_month).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {new Date(payment.created_at).toLocaleDateString()} at {new Date(payment.created_at).toLocaleTimeString()}
                      </p>
                      {payment.completed_at && (
                        <p className="text-sm text-green-600">
                          Completed: {new Date(payment.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(payment.status)}
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      KES {payment.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center gap-3">
                  {/* <button className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors">
                    <Download className="w-4 h-4" />
                    Receipt
                  </button> */}
                  {payment.status === 'failed' && (
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                      Retry Payment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No payments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' || methodFilter !== 'all' 
                ? 'Try adjusting your filters.' 
                : `No payments made in ${selectedYear}.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPayments;