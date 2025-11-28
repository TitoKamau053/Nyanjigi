import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, CheckCircle, Clock, XCircle, Search, Filter } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Payment {
  id: number;
  customer_id: number;
  customer_name: string;
  account_number: string;
  amount: string; 
  payment_method: string; 
  transaction_id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at?: string;
}

const PaymentManagement: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const { showToast } = useToast();

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await adminService.getPayments();
      setPayments(response.data?.data?.payments || []);
    } catch (error) {
      showToast('Failed to fetch payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (paymentId: number) => {
    try {
      await adminService.verifyPayment(paymentId);
      await fetchPayments();
      showToast('Payment verified successfully', 'success');
    } catch (error) {
      showToast('Failed to verify payment', 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
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

  const handleViewPayment = (payment: Payment) => {
  setSelectedPayment(payment);
  setShowModal(true);
  };

  const getMethodIcon = (method: string) => {
    // Handle equity payment methods
    if (method?.includes('equity')) {
      if (method.includes('mpesa')) return <Smartphone className="w-4 h-4 text-green-600" />;
      return <CreditCard className="w-4 h-4 text-blue-600" />;
    }
    
    switch (method) {
      case 'mpesa': return <Smartphone className="w-4 h-4 text-green-600" />;
      case 'cash': return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'bank_transfer': return <CreditCard className="w-4 h-4 text-purple-600" />;
      default: return <CreditCard className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.transaction_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.payment_method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const completedAmount = payments.filter(p => p.status === 'completed').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  
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
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-gray-600 mt-1">Track and manage customer payments</p>
        </div>
      </div>

      {/* Stats Cards */}
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
              <p className="text-2xl font-bold text-gray-900">KES {completedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">KES {pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-green-600" />
              <div className="text-sm text-gray-600">M-Pesa</div>
              <div className="text-2xl font-bold text-gray-900">
                {payments.filter(p => p.payment_method?.includes('mpesa')).length}
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

      {/* Payments Table */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{payment.customer_name}</div>
                      <div className="text-sm text-gray-500 font-mono">{payment.account_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{payment.transaction_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">KES {payment.amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getMethodIcon(payment.payment_method)}
                      <span className="text-sm text-gray-900 capitalize">
                        {payment.payment_method.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payment.status)}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(payment.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleViewPayment(payment)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        View
                      </button>
                      {payment.status === 'pending' && (
                        <button
                          onClick={() => verifyPayment(payment.id)}
                          className="text-green-600 hover:text-green-900 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                      <button className="text-red-600 hover:text-red-900 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPayments.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No payments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' || methodFilter !== 'all' 
              ? 'Try adjusting your filters.' 
              : 'Payments will appear here once customers start making payments.'}
          </p>
        </div>
      )}

      {/* Payment Details Modal */}
      {showModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction ID:</span>
                <span className="font-mono">{selectedPayment.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span>{selectedPayment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account:</span>
                <span className="font-mono">{selectedPayment.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-bold">KES {parseFloat(selectedPayment.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="capitalize">{selectedPayment.payment_method.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded ${getStatusColor(selectedPayment.status)}`}>
                  {selectedPayment.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span>{new Date(selectedPayment.created_at).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;