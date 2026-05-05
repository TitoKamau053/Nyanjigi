import React, { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, AlertCircle, Download, Plus, Droplets, Search } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Bill {
  id: number;
  customer_id: number;
  customer_name: string;
  account_number: string;
  customer_type: 'normal' | 'institution';
  total_amount: number;
  current_charges: number;
  billing_month: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'partially_paid';
  created_at: string;
  bill_type: 'flat_rate' | 'metered';
  meter_reading_previous?: number;
  meter_reading_current?: number;
  units_consumed?: number;
  rate_per_unit?: number;
}

interface BillStats {
  total_paid_amount: number;
  total_pending_amount: number;
  total_overdue_amount: number;
}

interface EditBillModalProps {
  bill: Bill;
  onClose: () => void;
  onSave: (updatedBill: Bill) => void;
}

const EditBillModal: React.FC<EditBillModalProps> = ({ bill, onClose, onSave }) => {
  const [status, setStatus] = useState(bill.status);

  const handleSave = () => {
    const updatedBill = { ...bill, status };
    onSave(updatedBill);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Bill Status</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer: {bill.customer_name}
            </label>
            <p className="text-sm text-gray-600">Account: {bill.account_number}</p>
            <p className="text-sm text-gray-600">Amount: KES {Number(bill.total_amount).toLocaleString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Bill['status'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="partially_paid">Partially Paid</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const BillingManagement: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [billStats, setBillStats] = useState<BillStats>({
    total_paid_amount: 0,
    total_pending_amount: 0,
    total_overdue_amount: 0
  });
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const { addToast } = useToast();

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Pagination and Search States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchBillStats();
    fetchBills(1);
  }, [selectedMonth]);

  const fetchBillStats = async () => {
    try {
      const response = await adminService.getBillStats();
      const stats = response.data.data?.summary || response.data.summary || {
        total_paid_amount: 0,
        total_pending_amount: 0,
        total_overdue_amount: 0
      };
      setBillStats(stats);
    } catch (error) {
      console.error('Failed to fetch bill stats:', error);
      addToast('Failed to fetch bill statistics', 'error');
    }
  };

  const fetchBills = async (page: number = 1, search: string = '', status: string = 'all') => {
    try {
      setLoading(true);
      const params: any = {
        month: selectedMonth,
        page,
        per_page: itemsPerPage,
      };
      
      if (search.trim()) {
        params.search = search.trim();
      }
      
      if (status !== 'all') {
        params.status = status;
      }

      const response = await adminService.getBills(params);
      const apiData = response.data.data || response.data;
      const billsData = apiData.bills || [];
      const paginationData = apiData.pagination || null;

      setBills(billsData);
      setPagination(paginationData);
      setCurrentPage(page);
    } catch (error) {
      addToast('Failed to fetch bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateBills = async () => {
    try {
      setLoading(true);
      await adminService.generateBills({ billing_month: selectedMonth + '-01' });
      await fetchBills(1, searchTerm, statusFilter);
      setShowGenerateModal(false);
      addToast('Bills generated successfully', 'success');
    } catch (error) {
      addToast('Failed to generate bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle search term changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1);
    setIsSearching(true);
  };

  // Handle status filter changes
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newPerPage: number) => {
    setItemsPerPage(newPerPage);
    setCurrentPage(1);
  };

  // Handle pagination change
  const handlePageChange = (page: number) => {
    fetchBills(page, searchTerm, statusFilter);
  };

  // Trigger search/filter whenever searchTerm, statusFilter, or itemsPerPage changes
  useEffect(() => {
    if (isSearching) {
      fetchBills(1, searchTerm, statusFilter);
      setIsSearching(false);
    }
  }, [searchTerm, statusFilter, itemsPerPage]);

const handleExport = async () => {
    try {
      const response = await adminService.exportBills({ format: 'csv', month: selectedMonth });
      const blob = new Blob([response.data], { type: 'text/csv' });
    } catch (error) {
      addToast('Failed to export bills', 'error');
    }
  };
  const handleViewBill = (billId: number) => {
    const bill = bills.find(b => b.id === billId) || null;
    setSelectedBill(bill);
    setShowViewModal(true);
  };

  const handleEditBill = (billId: number) => {
    const bill = bills.find(b => b.id === billId) || null;
    setSelectedBill(bill);
    setShowEditModal(true);
  };

  const handleDeleteBill = async (billId: number) => {
    if (window.confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
      try {
        await adminService.updateBillStatus(billId, { status: 'partially_paid' });
        addToast('Bill updated successfully', 'success');
        await fetchBills();
      } catch (error) {
        addToast('Failed to update bill', 'error');
      }
    }
  };

  const handleBulkMarkPaid = async (billIds: number[]) => {
    try {
      await adminService.bulkUpdateBillStatus({
        bill_ids: billIds,
        status: 'paid'
      });
      addToast(`${billIds.length} bills marked as paid`, 'success');
      await fetchBills();
    } catch (error) {
      addToast('Failed to update bills', 'error');
    }
  };

  const handleMarkPaid = async (billId: number) => {
    try {
      await adminService.updateBillStatus(billId, { status: 'paid' });
      addToast('Bill marked as paid', 'success');
      fetchBills(currentPage, searchTerm, statusFilter);
    } catch (error) {
      addToast('Failed to mark bill as paid', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDisplayStatus = (bill: Bill) => {
    if (bill.status !== 'paid' && new Date(bill.due_date) < new Date()) {
      return 'overdue';
    }
    return bill.status;
  };

  const totalAmount = Math.round(bills.filter(b => b.status === 'paid').reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0));
  const pendingAmount = Math.round(bills.filter(b => getDisplayStatus(b) === 'pending').reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0));
  const overdueAmount = Math.round(bills.filter(b => getDisplayStatus(b) === 'overdue').reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0));

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
          <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-600 mt-1">Generate and manage customer bills</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => {
              const pendingBills = bills.filter(b => getDisplayStatus(b) === 'pending').map(b => b.id);
              if (pendingBills.length > 0) {
                handleBulkMarkPaid(pendingBills);
              } else {
                addToast('No pending bills to mark as paid', 'warning');
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            Bulk Mark Paid
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Bills
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer name or account..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="partially_paid">Partially Paid</option>
          </select>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{pagination?.total || bills.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Bill Modal */}
      {showViewModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex justify-between">
              <span>View Bill Details</span>
              <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(getDisplayStatus(selectedBill))}`}>
                {getDisplayStatus(selectedBill).toUpperCase()}
              </span>
            </h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Customer</p>
                  <p className="font-medium text-gray-900">{selectedBill.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Account</p>
                  <p className="font-mono text-gray-900">{selectedBill.account_number}</p>
                </div>
              </div>

              {selectedBill.bill_type === 'metered' ? (
                <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                    <Droplets className="w-4 h-4" /> Metered Usage Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <p className="text-gray-600">Previous Reading:</p>
                    <p className="font-mono text-right">{selectedBill.meter_reading_previous}</p>
                    <p className="text-gray-600">Current Reading:</p>
                    <p className="font-mono text-right">{selectedBill.meter_reading_current}</p>
                    <p className="text-gray-600 font-medium">Units Consumed:</p>
                    <p className="font-mono font-bold text-blue-600 text-right">{selectedBill.units_consumed} units</p>
                    <p className="text-gray-600">Rate per Unit:</p>
                    <p className="font-mono text-right">KES {selectedBill.rate_per_unit}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded text-sm text-gray-600 italic">
                  Flat Rate Billing Applied
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <p><strong>Total Amount:</strong> KES {Number(selectedBill.total_amount).toLocaleString()}</p>
                <p><strong>Due Date:</strong> {new Date(selectedBill.due_date).toLocaleDateString()}</p>
                <p><strong>Generated:</strong> {new Date(selectedBill.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {showEditModal && selectedBill && (
        <EditBillModal
          bill={selectedBill}
          onClose={() => setShowEditModal(false)}
          onSave={async (updatedBill) => {
            try {
              await adminService.updateBillStatus(updatedBill.id, { status: updatedBill.status });
              addToast('Bill updated successfully', 'success');
              setShowEditModal(false);
              await fetchBills();
            } catch (error) {
              addToast('Failed to update bill', 'error');
            }
          }}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-2xl font-bold text-gray-900">KES {totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">KES {pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">KES {overdueAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/30 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Bills for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={handleExport}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type / Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{bill.customer_name}</div>
                    <div className="text-xs font-mono text-gray-500">{bill.account_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {bill.bill_type === 'metered' ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full w-max">
                          <Droplets className="w-3 h-3" /> Metered
                        </span>
                        <span className="text-xs text-gray-500 mt-1">{bill.units_consumed} units</span>
                      </div>
                    ) : (
                      <span className="inline-flex text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full w-max">
                        Flat Rate
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      KES {Number(bill.total_amount).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{new Date(bill.due_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(getDisplayStatus(bill))}`}>
                      {getDisplayStatus(bill)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleViewBill(bill.id)} className="text-blue-600 hover:text-blue-900" title="View Details">
                        View
                      </button>
                      <button onClick={() => handleEditBill(bill.id)} className="text-indigo-600 hover:text-indigo-900" title="Edit Status">
                        Edit
                      </button>
                      {getDisplayStatus(bill) !== 'paid' && (
                        <button onClick={() => handleMarkPaid(bill.id)} className="text-green-600 hover:text-green-900" title="Mark Paid">
                          Pay
                        </button>
                      )}
                      <button onClick={() => handleDeleteBill(bill.id)} className="text-red-600 hover:text-red-900" title="Delete">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination && (
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Items per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} results
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={!pagination.has_prev}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => {
                const showPage = 
                  page === 1 || 
                  page === pagination.total_pages || 
                  Math.abs(page - pagination.current_page) <= 1;
                
                if (!showPage && (page === 2 || page === pagination.total_pages - 1)) {
                  return <span key={`ellipsis-${page}`} className="px-2 py-1">...</span>;
                }

                if (!showPage) return null;

                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                      page === pagination.current_page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={!pagination.has_next}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No bills found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filter terms.' : 'Generate bills for this month to get started.'}
          </p>
        </div>
      )}

      {/* Generate Bills Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Bills</h3>
            <p className="text-gray-600 mb-6">
              Generate bills for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}?
              This will automatically fetch recorded meter readings and calculate totals.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateBills}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingManagement;