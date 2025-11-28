import React, { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, AlertCircle, Download, Plus } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Bill {
  id: number;
  customer_id: number;
  customer_name: string;
  account_number: string;
  customer_type: 'normal' | 'institution';
  total_amount: number;
  billing_month: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
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
              <option value="cancelled">Cancelled</option>
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

  // New state for modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  useEffect(() => {
    fetchBillStats();
    fetchBills();
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

  const fetchBills = async () => {
    try {
      const response = await adminService.getBills({ month: selectedMonth });
      const apiData = response.data.data || response.data;
      const billsData = apiData.bills || [];
      const paginationData = apiData.pagination || null;

      // Debug: Log the bills data to see what's being returned
      console.log('Bills data:', billsData);
      console.log('First bill sample:', billsData[0]);

      setBills(billsData);
      setPagination(paginationData);
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
      await fetchBills();
      setShowGenerateModal(false);
      addToast('Bills generated successfully', 'success');
    } catch (error) {
      addToast('Failed to generate bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Export bills as CSV for now
      const response = await adminService.exportBills('csv');
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bills_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      addToast('Bills exported successfully', 'success');
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
        await adminService.updateBillStatus(billId, { status: 'cancelled' });
        addToast('Bill deleted successfully', 'success');
        await fetchBills();
      } catch (error) {
        addToast('Failed to delete bill', 'error');
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
      await fetchBills();
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

  // Determine display status considering due date and status
  const getDisplayStatus = (bill: Bill) => {
    if (bill.status !== 'paid' && new Date(bill.due_date) < new Date()) {
      return 'overdue';
    }
    return bill.status;
  };

  const getCustomerTypeRate = (customerType: string) => {
    return customerType === 'institution' ? 1000 : 300; // Institution rate is higher
  };

  // Total Amount is total value for paid bills
  const totalAmount = Math.round(bills.filter(b => b.status === 'paid').reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0));
  // Amount column should show total_amount per bill (already done in table)
  const paidAmount = totalAmount;
  // Pending amount should be sum of bills with display status 'pending'
  const pendingAmount = Math.round(bills.filter(b => getDisplayStatus(b) === 'pending').reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0));
  // Overdue amount should be sum of overdue bills from bills array, not from billStats
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

      {/* View Bill Modal */}
      {showViewModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">View Bill Details</h3>
            <div className="space-y-2">
              <p><strong>Customer:</strong> {selectedBill.customer_name}</p>
              <p><strong>Account Number:</strong> {selectedBill.account_number}</p>
              <p><strong>Amount:</strong> KES {Number(selectedBill.total_amount).toLocaleString()}</p>
              <p><strong>Billing Month:</strong> {selectedBill.billing_month}</p>
              <p><strong>Due Date:</strong> {new Date(selectedBill.due_date).toLocaleDateString()}</p>
              <p><strong>Status:</strong> {getDisplayStatus(selectedBill)}</p>
              <p><strong>Created At:</strong> {new Date(selectedBill.created_at).toLocaleString()}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
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
              <p className="text-sm text-gray-600">Total Amount</p>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{bill.customer_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{bill.account_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        bill.customer_type === 'institution'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {bill.customer_type === 'institution' ? '🏢 Institution' : '👤 Normal'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      KES {getCustomerTypeRate(bill.customer_type)}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewBill(bill.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="View bill details"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditBill(bill.id)}
                        className="text-indigo-600 hover:text-indigo-900 transition-colors"
                        title="Edit bill status"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleMarkPaid(bill.id)}
                        className="text-green-600 hover:text-green-900 transition-colors"
                        title="Mark as paid"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete bill"
                      >
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

      {bills.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No bills found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate bills for this month to get started.
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