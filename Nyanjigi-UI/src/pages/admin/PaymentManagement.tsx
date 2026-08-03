import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, CheckCircle, Clock, XCircle } from 'lucide-react';
import SearchBar from '../../components/common/SearchBar';
import PaginationControls from '../../components/common/PaginationControls';
import useServerSearch from '../../hooks/useServerSearch';
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const { addToast } = useToast();

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showModal, setShowModal] = useState(false);

  const {
    data: payments,
    totalItems,
    totalPages,
    hasPrev,
    hasNext,
    currentPage,
    itemsPerPage,
    searchTerm,
    setSearchTerm,
    setCurrentPage,
    setItemsPerPage,
    loading: serverLoading,
    refresh,
  } = useServerSearch<Payment>((params) => adminService.getPayments({ page: params.page, limit: params.limit, status: statusFilter === 'all' ? undefined : (statusFilter as any), start_date: params.start_date, end_date: params.end_date, search: params.search }), { initialPage: 1, initialLimit: 10 });

  useEffect(() => { setLoading(serverLoading); }, [serverLoading]);

const verifyPayment = async (_paymentId: number) => {
    try {
      // Typically you would call a backend endpoint here to verify
      // await adminService.verifyPayment(_paymentId);
      await refresh();
      addToast('Payment verified successfully', 'success');
    } catch (error) {
      addToast('Failed to verify payment', 'error');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleMethodChange = (method: string) => {
    setMethodFilter(method);
    setCurrentPage(1);
  };

  const visiblePayments = payments || [];

  const completedAmount = (visiblePayments.filter((payment) => payment.status === 'completed') || []).reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  const pendingAmount = (visiblePayments.filter((payment) => payment.status === 'pending') || []).reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-gray-600 mt-1">Track and manage customer payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Filtered</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Page Completed</p>
              <p className="text-2xl font-bold text-gray-900">KES {completedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Page Pending</p>
              <p className="text-2xl font-bold text-gray-900">KES {pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Page M-Pesa</p>
                <p className="text-2xl font-bold text-gray-900">
                  {visiblePayments.filter((payment) => payment.payment_method?.includes('mpesa')).length}
                </p>
              </div>
          </div>
        </div>
      </div>

      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <SearchBar value={searchTerm} onChange={handleSearchChange} placeholder="Search payments..." />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
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
            onChange={(e) => handleMethodChange(e.target.value)}
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
              {visiblePayments.map((payment) => (
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

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPageChange={(n: number) => setCurrentPage(n)}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n: number) => setItemsPerPage(n)}
        totalItems={totalItems}
      />

      {visiblePayments.length === 0 && !loading && (
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