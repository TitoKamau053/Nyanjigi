import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, CreditCard, Calendar, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { customerService } from '../../services/customerService';

interface Bill {
  id: number;
  bill_number: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  due_date: string;
  status: string;
  paid_at?: string;
  fines_applied: number;
  created_at: string;
}

const CustomerBills: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBillForView, setSelectedBillForView] = useState<Bill | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchBills();
  }, [selectedYear]);

  const fetchBills = async () => {
    try {
      const response = await customerService.getBills({ page: 1, limit: 10, year: selectedYear });
      setBills(response.data.data?.bills || []);
    } catch (error: any) {
      if (error.response?.status === 401) {
        addToast('Unauthorized access. Please login again.', 'error');
        window.location.href = '/auth';
      } else {
        addToast('Failed to fetch bills', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

    const initiatePayment = (bill: Bill) => {
      setSelectedBillForPayment(bill);
      setShowPaymentModal(true);
    };



  const getDisplayStatus = (bill: Bill) => {
    if (bill.status === 'paid') return 'paid';
    if (bill.status === 'cancelled') return 'cancelled';

    const dueDate = new Date(bill.due_date);
    const today = new Date();
    const isOverdue = today > dueDate;

    if (isOverdue) return 'overdue';
    return 'pending';
  };

  const downloadBill = async (bill: Bill) => {
    try {
      // Create a simple bill summary for download
      const billData = {
        billNumber: bill.bill_number,
        customerName: 'Customer', // This would come from customer context
        billingPeriod: `${new Date(bill.billing_period_start).toLocaleDateString()} - ${new Date(bill.billing_period_end).toLocaleDateString()}`,
        dueDate: new Date(bill.due_date).toLocaleDateString(),
        totalAmount: Number(bill.total_amount),
        finesApplied: Number(bill.fines_applied),
        status: getDisplayStatus(bill),
        createdAt: new Date(bill.created_at).toLocaleDateString()
      };

      const csvContent = `Bill Details\nBill Number,${billData.billNumber}\nBilling Period,${billData.billingPeriod}\nDue Date,${billData.dueDate}\nTotal Amount,KES ${billData.totalAmount}\nFines Applied,KES ${billData.finesApplied}\nStatus,${billData.status}\nCreated At,${billData.createdAt}`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bill_${bill.bill_number}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      addToast('Bill downloaded successfully', 'success');
    } catch (error) {
      addToast('Failed to download bill', 'error');
    }
  };

  const viewBillDetails = (bill: Bill) => {
    setSelectedBillForView(bill);
    setShowViewModal(true);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return '✓';
      case 'pending': return '⏳';
      case 'overdue': return '⚠️';
      case 'cancelled': return '✕';
      default: return '?';
    }
  };

  // Updated calculations with proper number parsing and safety checks
  const totalBillsAmount = bills.reduce((sum, bill) => {
    const billAmount = Number(bill.total_amount) || 0;
    const finesAmount = Number(bill.fines_applied) || 0;
    return sum + billAmount + finesAmount;
  }, 0);

  const paidAmount = bills.filter(b => getDisplayStatus(b) === 'paid').reduce((sum, bill) => {
    const billAmount = Number(bill.total_amount) || 0;
    const finesAmount = Number(bill.fines_applied) || 0;
    return sum + billAmount + finesAmount;
  }, 0);

  const pendingAmount = bills.filter(b => getDisplayStatus(b) === 'pending').reduce((sum, bill) => {
    const billAmount = Number(bill.total_amount) || 0;
    const finesAmount = Number(bill.fines_applied) || 0;
    return sum + billAmount + finesAmount;
  }, 0);

  const overdueAmount = bills.filter(b => getDisplayStatus(b) === 'overdue').reduce((sum, bill) => {
    const billAmount = Number(bill.total_amount) || 0;
    const finesAmount = Number(bill.fines_applied) || 0;
    return sum + billAmount + finesAmount;
  }, 0);

  // Helper function for consistent currency formatting
  const formatCurrency = (amount: number): string => {
    return `KES ${amount.toFixed(2)}`;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">My Bills</h1>
          <p className="text-gray-600 mt-1">View and manage your water bills</p>
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
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="px-6 py-4 border-b border-white/30">
          <h3 className="text-lg font-semibold text-gray-900">Bills for {selectedYear}</h3>
        </div>
        
        {bills.length > 0 ? (
          <div className="divide-y divide-white/30">
            {bills.map((bill) => {
              const billTotal = Number(bill.total_amount) || 0;
              const finesTotal = Number(bill.fines_applied) || 0;
              const totalBillAmount = billTotal + finesTotal;

              return (
                <div key={bill.id} className="p-6 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xl">{getStatusIcon(bill.status)}</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {new Date(bill.billing_period_start).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Due: {new Date(bill.due_date).toLocaleDateString()}
                        </p>
                        {bill.paid_at && (
                          <p className="text-sm text-green-600">
                            Paid: {new Date(bill.paid_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(getDisplayStatus(bill))}`}>
                          {getDisplayStatus(bill).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(totalBillAmount)}
                      </p>
                      {finesTotal > 0 && (
                        <p className="text-sm text-red-600">
                          (includes {formatCurrency(finesTotal)} late fee)
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => downloadBill(bill)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => viewBillDetails(bill)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    {(getDisplayStatus(bill) === 'pending' || getDisplayStatus(bill) === 'overdue') && (
                      <button
                        onClick={() => initiatePayment(bill)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bills found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No bills available for {selectedYear}.
            </p>
          </div>
        )}
      </div>

        {/* Payment Modal */}
          {showPaymentModal && selectedBillForPayment && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowPaymentModal(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h3>
              
              <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  Bill Period: <span className="font-semibold">
                    {new Date(selectedBillForPayment.billing_period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Amount: <span className="font-semibold text-blue-600">
                    {formatCurrency(Number(selectedBillForPayment.total_amount) + Number(selectedBillForPayment.fines_applied))}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Choose Payment Method:</h4>
                
                {/* Equity M-Pesa Paybill */}
                <div className="border border-gray-200 rounded-lg p-4 hover:border-green-500 hover:bg-green-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-green-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Equity M-Pesa Paybill</p>
                      <p className="text-xs text-gray-600 mt-1">Paybill: <span className="font-mono font-semibold">247247</span></p>
                      <p className="text-xs text-gray-600">Account: <span className="font-mono font-semibold">Your Account Number</span></p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                    <p className="font-semibold mb-1">Steps:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to M-Pesa menu</li>
                      <li>Select Lipa na M-Pesa → Paybill</li>
                      <li>Enter Business No: <span className="font-mono">247247</span></li>
                      <li>Enter Account: Your account number</li>
                      <li>Enter Amount: {formatCurrency(Number(selectedBillForPayment.total_amount) + Number(selectedBillForPayment.fines_applied))}</li>
                      <li>Enter M-Pesa PIN</li>
                    </ol>
                  </div>
                </div>

                {/* Equity Bank Branch */}
                <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Equity Bank Branch</p>
                      <p className="text-xs text-gray-600 mt-1">Visit any Equity Bank branch</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                    <p>Visit any Equity Bank branch with your account number and make a cash deposit.</p>
                  </div>
                </div>

                {/* Equity Agent */}
                <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Equity Agent</p>
                      <p className="text-xs text-gray-600 mt-1">Visit any Equity Bank agent</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                    <p>Locate your nearest Equity Bank agent and make payment using your account number.</p>
                  </div>
                </div>

                {/* Equitel */}
                <div className="border border-gray-200 rounded-lg p-4 hover:border-orange-500 hover:bg-orange-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-orange-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Equitel</p>
                      <p className="text-xs text-gray-600 mt-1">Use your Equitel line</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                    <p>Dial *247# on your Equitel line and follow the prompts to make payment.</p>
                  </div>
                </div>

                {/* Equity Mobile App */}
                <div className="border border-gray-200 rounded-lg p-4 hover:border-red-500 hover:bg-red-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-red-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Equity Mobile App</p>
                      <p className="text-xs text-gray-600 mt-1">Use Equity Mobile Banking App</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                    <p>Login to your Equity Mobile App, select payments, and enter your account number.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <span className="font-semibold">Note:</span> Your payment will be automatically recorded once confirmed by Equity Bank. This may take a few minutes.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      {/* View Bill Modal */}
      {showViewModal && selectedBillForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Bill Number:</span>
                <span className="font-medium">{selectedBillForView.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Billing Period:</span>
                <span className="font-medium">
                  {new Date(selectedBillForView.billing_period_start).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                  })} - {new Date(selectedBillForView.billing_period_end).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date:</span>
                <span className="font-medium">{new Date(selectedBillForView.due_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">KES {Number(selectedBillForView.total_amount).toLocaleString()}</span>
              </div>
              {Number(selectedBillForView.fines_applied) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Late Fee:</span>
                  <span className="font-medium text-red-600">KES {Number(selectedBillForView.fines_applied).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(getDisplayStatus(selectedBillForView))}`}>
                  {getDisplayStatus(selectedBillForView).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">{new Date(selectedBillForView.created_at).toLocaleDateString()}</span>
              </div>
              {selectedBillForView.paid_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid Date:</span>
                  <span className="font-medium text-green-600">{new Date(selectedBillForView.paid_at).toLocaleDateString()}</span>
                </div>
              )}
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
    </div>
  );
};

export default CustomerBills;