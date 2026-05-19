import React, { useState, useEffect } from 'react';
import { Download, Eye, Filter, Search, FileText, DollarSign, Calendar, Printer } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';

interface Receipt {
  id: number;
  receipt_number: string;
  payment_type: 'bill' | 'contribution' | 'fine' | 'advance';
  amount: string;
  payment_method: string;
  payment_reference?: string;
  description?: string;
  issued_date: string;
  customer_name?: string;
  transaction_id?: string;
}

interface PaginationInfo {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const CustomerReceipts: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [filterType, setFilterType] = useState<'' | 'bill' | 'contribution' | 'fine' | 'advance'>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchReceipts();
  }, [currentPage, filterType]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await customerService.getMyReceipts({
        page: currentPage,
        limit: 10,
        payment_type: filterType || undefined
      });

      const data = response.data?.data || {};
      setReceipts(data.receipts || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      addToast('Failed to fetch receipts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'bill':
        return 'bg-blue-100 text-blue-800';
      case 'contribution':
        return 'bg-purple-100 text-purple-800';
      case 'fine':
        return 'bg-red-100 text-red-800';
      case 'advance':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'bill':
        return 'Water Bill';
      case 'contribution':
        return 'Contribution';
      case 'fine':
        return 'Fine/Penalty';
      case 'advance':
        return 'Advance Payment';
      default:
        return type;
    }
  };

  const handleViewReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowPreview(true);
  };

  const handlePrintReceipt = (receipt: Receipt) => {
    // In a real application, this would trigger a print dialog
    window.print();
  };

  if (loading && receipts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payment Receipts</h1>
        <p className="text-gray-600 mt-1">View and download your payment receipts</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Receipts</p>
              <p className="text-2xl font-bold text-gray-900">{pagination?.total || 0}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">
                KSh {receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Period</p>
              <p className="text-2xl font-bold text-purple-600">
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt number or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <Filter className="w-5 h-5 text-gray-400 mt-2" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Receipts</option>
              <option value="bill">Water Bills</option>
              <option value="contribution">Contributions</option>
              <option value="fine">Fines & Penalties</option>
              <option value="advance">Advance Payments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Receipt #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="font-mono text-sm font-medium text-gray-900">{receipt.receipt_number}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getPaymentTypeColor(receipt.payment_type)}`}>
                    {getPaymentTypeLabel(receipt.payment_type)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600 truncate">{receipt.description || 'N/A'}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    KSh {parseFloat(receipt.amount).toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-600">{formatDate(receipt.issued_date)}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewReceipt(receipt)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => handlePrintReceipt(receipt)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                    >
                      <Printer className="w-3 h-3" />
                      Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {receipts.length === 0 && (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No receipts found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {pagination.total_pages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(pagination.total_pages, currentPage + 1))}
            disabled={currentPage === pagination.total_pages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showPreview && selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto p-8">
            {/* Receipt Header */}
            <div className="text-center mb-8 pb-8 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">PAYMENT RECEIPT</h2>
              <p className="text-gray-600 mt-1">{selectedReceipt.receipt_number}</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Receipt Number</p>
                  <p className="text-lg font-mono text-gray-900">{selectedReceipt.receipt_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Date Issued</p>
                  <p className="text-lg text-gray-900">{formatDate(selectedReceipt.issued_date)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Payment Type:</span>
                  <span className="font-medium text-gray-900">
                    {getPaymentTypeLabel(selectedReceipt.payment_type)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Amount Paid:</span>
                  <span className="text-lg font-bold text-green-600">
                    KSh {parseFloat(selectedReceipt.amount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Payment Method:</span>
                  <span className="font-medium text-gray-900">{selectedReceipt.payment_method}</span>
                </div>
                {selectedReceipt.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Transaction Reference:</span>
                    <span className="font-mono text-gray-900">{selectedReceipt.payment_reference}</span>
                  </div>
                )}
                {selectedReceipt.description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Description:</span>
                    <span className="text-gray-900">{selectedReceipt.description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-600">
                This is an automatically generated receipt. For inquiries, contact us at info@nyanjigi.co.ke
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-8 pt-8 border-t border-gray-200">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReceipts;
