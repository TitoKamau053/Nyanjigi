import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, DollarSign, TrendingUp, Plus, AlertCircle, Check, Edit2
} from 'lucide-react';
import SearchBar from '../../components/common/SearchBar';
import PaginationControls from '../../components/common/PaginationControls';
import useClientSearch from '../../hooks/useClientSearch';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const TOTAL_CONTRIBUTION = 20500; 

interface Contribution {
  id: number;
  customer_id: number;
  customer_name: string;
  account_number: string;
  amount_required: string;
  amount_paid: string;
  contribution_month: string;
  payment_status: 'unpaid' | 'partial' | 'fully_paid';
  status: 'pending' | 'partial' | 'completed' | 'overdue';
  due_date: string;
  last_payment_date?: string;
  created_at: string;
  outstanding_amount: string;
  days_overdue?: number;
  phone?: string;
}

const ContributionManagement: React.FC = () => {
  const [allContributions, setAllContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [markingAs, setMarkingAs] = useState<'partial' | 'fully_paid' | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    fetchContributions();
  }, [selectedMonth]);

  const fetchContributions = async () => {
    try {
      setLoading(true);

      const allFetchedContributions: Contribution[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const response = await adminService.getContributions({
          page: currentPage,
          limit: 100,
          month: selectedMonth,
        });

        const contributionsData = response.data?.data?.contributions || [];
        allFetchedContributions.push(...contributionsData);
        totalPages = response.data?.data?.pagination?.total_pages || 1;
        currentPage += 1;
      } while (currentPage <= totalPages);

      setAllContributions(allFetchedContributions);
    } catch (error) {
      console.error('Error fetching contributions:', error);
      addToast('Failed to fetch contributions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateContributions = async () => {
    try {
      setLoading(true);
      await adminService.generateContributions({ contribution_month: selectedMonth + '-01' });
      await fetchContributions();
      setShowGenerateModal(false);
      addToast('Contributions generated successfully', 'success');
    } catch (error) {
      addToast('Failed to generate contributions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const markContributionPayment = async () => {
    if (!selectedContribution) return;

    try {
      setLoading(true);
      if (markingAs === 'partial') {
        await adminService.markContributionPartiallyPaid(selectedContribution.id, {
          notes: paymentNotes
        });
        addToast('Contribution marked as partially paid', 'success');
      } else if (markingAs === 'fully_paid') {
        await adminService.markContributionFullyPaid(selectedContribution.id, {
          notes: paymentNotes
        });
        addToast('Contribution marked as fully paid', 'success');
      }

      setShowPaymentModal(false);
      setPaymentNotes('');
      setSelectedContribution(null);
      setMarkingAs(null);
      await fetchContributions();
    } catch (error) {
      addToast('Failed to update contribution status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const statusFilteredContributions = useMemo(() => {
    return allContributions;
  }, [allContributions]);

  const {
    paginatedData: contributions,
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
  } = useClientSearch<Contribution>(statusFilteredContributions, ['customer_name', 'account_number', 'phone'], 10);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unpaid':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Unpaid</span>;
      case 'partial':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Partially Paid</span>;
      case 'fully_paid':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Fully Paid</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  const getOverdueIndicator = (daysOverdue?: number) => {
    if (!daysOverdue || daysOverdue <= 0) return null;
    return (
      <div className="flex items-center gap-1 text-red-600 text-xs">
        <AlertCircle className="w-3 h-3" />
        {daysOverdue} days overdue
      </div>
    );
  };

  // Calculate statistics
  const stats = {
    total: statusFilteredContributions.length,
    fully_paid: statusFilteredContributions.filter((contribution) => contribution.payment_status === 'fully_paid').length,
    partially_paid: statusFilteredContributions.filter((contribution) => contribution.payment_status === 'partial').length,
    unpaid: statusFilteredContributions.filter((contribution) => contribution.payment_status === 'unpaid').length,
    total_expected: statusFilteredContributions.length * TOTAL_CONTRIBUTION,
    total_collected: statusFilteredContributions.reduce((sum, contribution) => sum + parseFloat(contribution.amount_paid || '0'), 0),
    total_outstanding: statusFilteredContributions.reduce((sum, contribution) => sum + parseFloat(contribution.outstanding_amount || '0'), 0),
  };

  const collectionRate = stats.total > 0 ? ((stats.total_collected / stats.total_expected) * 100).toFixed(1) : 0;

  if (loading && contributions.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Contribution Management</h1>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Contributions
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Expected</p>
              <p className="text-2xl font-bold text-gray-900">
                KSh {stats.total_expected.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">
                KSh {stats.total_collected.toLocaleString()}
              </p>
            </div>
            <Check className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">
                KSh {stats.total_outstanding.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Collection Rate</p>
              <p className="text-2xl font-bold text-purple-600">
                {collectionRate}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <SearchBar value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by customer name or account number..." />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Fully Paid: <span className="font-semibold">{stats.fully_paid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">Partially Paid: <span className="font-semibold">{stats.partially_paid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Unpaid: <span className="font-semibold">{stats.unpaid}</span></span>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Account</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Target Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Amount Paid</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Balance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contributions.map((contribution) => (
              <tr key={contribution.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="font-medium text-gray-900">{contribution.customer_name}</p>
                    <p className="text-xs text-gray-500">{contribution.phone}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {contribution.account_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-medium text-gray-900">
                    KSh {TOTAL_CONTRIBUTION.toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-medium text-green-600">
                    KSh {parseFloat(contribution.amount_paid).toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-medium text-red-600">
                    KSh {parseFloat(contribution.outstanding_amount).toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(contribution.payment_status)}
                    {getOverdueIndicator(contribution.days_overdue)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => {
                      setSelectedContribution(contribution);
                      setShowPaymentModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    Mark Payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {contributions.length === 0 && (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No contributions found for the selected period</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPageChange={(n) => setCurrentPage(n)}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n) => setItemsPerPage(n)}
        totalItems={totalItems}
      />

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Contributions</h2>
            <p className="text-gray-600 mb-6">
              This will generate contributions of KSh {TOTAL_CONTRIBUTION.toLocaleString()} for all active customers for {selectedMonth}.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={generateContributions}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedContribution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Mark Contribution Payment</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Customer:</span>
                  <span className="font-medium">{selectedContribution.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Account:</span>
                  <span className="font-medium">{selectedContribution.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Target Amount:</span>
                  <span className="font-medium">KSh {TOTAL_CONTRIBUTION.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-green-600">KSh {parseFloat(selectedContribution.amount_paid).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setMarkingAs('partial')}
                className={`w-full p-3 border-2 rounded-lg transition-colors ${
                  markingAs === 'partial'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-300'
                }`}
              >
                <p className="font-medium text-gray-900">Mark as Partially Paid</p>
                <p className="text-xs text-gray-600">Customer has made partial payment</p>
              </button>

              <button
                onClick={() => setMarkingAs('fully_paid')}
                className={`w-full p-3 border-2 rounded-lg transition-colors ${
                  markingAs === 'fully_paid'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <p className="font-medium text-gray-900">Mark as Fully Paid</p>
                <p className="text-xs text-gray-600">Customer has paid full contribution</p>
              </button>
            </div>

            <textarea
              placeholder="Add notes (optional)"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 resize-none"
              rows={3}
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentNotes('');
                  setSelectedContribution(null);
                  setMarkingAs(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={markContributionPayment}
                disabled={loading || !markingAs}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContributionManagement;