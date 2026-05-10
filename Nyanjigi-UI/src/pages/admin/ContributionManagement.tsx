import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Plus, Download, AlertCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

// Contribution target amount per customer
const CONTRIBUTION_TARGET = 20500;

interface Contribution {
  id: number;
  customer_id: number;
  customer_name: string;
  account_number: string;
  customer_type: 'normal' | 'institution';
  amount_required: string;
  amount_paid: string;
  contribution_month: string;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string;
  paid_date?: string;
  created_at: string;
  completed_at?: string;
  outstanding_amount: string;
  display_status: string;
  partial_payments_total?: number; // New: Total of all partial contribution payments
}

interface Payment {
  id: number;
  customer_id: number;
  amount: string;
  payment_date: string;
  status: string;
  payment_method: string;
  contribution_amount?: string;
}

const ContributionManagement: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [paymentData, setPaymentData] = useState<Map<number, number>>(new Map()); // customer_id -> total paid
  const { addToast } = useToast();

  useEffect(() => {
    fetchContributions();
  }, [selectedMonth]);

  const fetchContributions = async () => {
    try {
      setLoading(true);
      
      // Fetch contributions
      const response = await adminService.getContributions({ month: selectedMonth });
      const allContributions = response.data?.data?.contributions || [];

      // Filter contributions by selected month as fallback
      const filteredContributions = allContributions.filter((contribution: Contribution) => {
        const contributionDate = new Date(contribution.contribution_month);
        const contributionMonth = contributionDate.getFullYear() + '-' +
          String(contributionDate.getMonth() + 1).padStart(2, '0');
        return contributionMonth === selectedMonth;
      });

      // Fetch all payments to calculate partial contributions
      const paymentsResponse = await adminService.getPayments({ limit: 10000 });
      const allPayments: Payment[] = paymentsResponse.data?.data?.payments || paymentsResponse.data?.payments || [];

      // Build payment map: customer_id -> total contribution amount paid
      const paymentMap = new Map<number, number>();
      allPayments.forEach((payment: Payment) => {
        // Only count completed payments that are marked as contribution payments
        if (payment.status === 'completed' && payment.contribution_amount) {
          const customerId = payment.customer_id;
          const amount = Number(payment.contribution_amount || 0);
          paymentMap.set(customerId, (paymentMap.get(customerId) || 0) + amount);
        }
      });

      setPaymentData(paymentMap);
      setContributions(filteredContributions);
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

  const markAsPaid = async (contributionId: number) => {
    try {
      await adminService.markContributionPaid(contributionId);
      await fetchContributions();
      addToast('Contribution marked as paid', 'success');
    } catch (error) {
      addToast('Failed to mark contribution as paid', 'error');
    }
  };

  // Calculate contribution accountability metrics
  const totalContributionTarget = contributions.length * CONTRIBUTION_TARGET;
  const totalPartialPaid = Array.from(paymentData.values()).reduce((sum, amount) => sum + amount, 0);
  const totalContributionRemaining = totalContributionTarget - totalPartialPaid;
  const contributionCollectionRate = contributions.length > 0 ? (totalPartialPaid / totalContributionTarget) * 100 : 0;

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
          <h1 className="text-3xl font-bold text-gray-900">Contribution Management</h1>
          <p className="text-gray-600 mt-1">Manage monthly customer contributions</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Contributors</p>
              <p className="text-2xl font-bold text-gray-900">{contributions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Target (KES 20,500 each)</p>
              <p className="text-2xl font-bold text-gray-900">KES {totalContributionTarget.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Collected (Partial)</p>
              <p className="text-2xl font-bold text-gray-900">KES {totalPartialPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className="text-2xl font-bold text-gray-900">KES {totalContributionRemaining.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">{Math.round(contributionCollectionRate)}%</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Collection Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(contributionCollectionRate)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/30 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Contributions for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button className="text-blue-600 hover:text-blue-800 flex items-center gap-2">
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
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid to Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
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
              {contributions.map((contribution) => {
                // Calculate partial payment for this customer
                const partialPaid = paymentData.get(contribution.customer_id) || 0;
                const remaining = CONTRIBUTION_TARGET - partialPaid;
                const percentagePaid = (partialPaid / CONTRIBUTION_TARGET) * 100;
                
                // Determine accountability status
                let accountabilityStatus = 'pending';
                let statusColor = 'bg-yellow-100 text-yellow-800';
                
                if (partialPaid >= CONTRIBUTION_TARGET) {
                  accountabilityStatus = 'complete';
                  statusColor = 'bg-green-100 text-green-800';
                } else if (partialPaid > 0) {
                  accountabilityStatus = 'partial';
                  statusColor = 'bg-blue-100 text-blue-800';
                }

                return (
                  <tr key={contribution.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{contribution.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{contribution.account_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">{contribution.customer_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">KES {CONTRIBUTION_TARGET.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${partialPaid > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        KES {partialPaid.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        KES {remaining.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              percentagePaid >= 100 ? 'bg-green-500' :
                              percentagePaid >= 50 ? 'bg-blue-500' :
                              percentagePaid > 0 ? 'bg-yellow-500' :
                              'bg-gray-300'
                            }`}
                            style={{ width: `${Math.min(percentagePaid, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 w-8">{Math.round(percentagePaid)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                        {accountabilityStatus === 'complete' ? '✓ Complete' :
                         accountabilityStatus === 'partial' ? '◐ Partial' :
                         '○ Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button className="text-blue-600 hover:text-blue-900 transition-colors">
                          View
                        </button>
                        {accountabilityStatus !== 'complete' && (
                          <button
                            onClick={() => markAsPaid(contribution.id)}
                            className="text-green-600 hover:text-green-900 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button className="text-indigo-600 hover:text-indigo-900 transition-colors">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {contributions.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No contributions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate contributions for this month to get started.
          </p>
        </div>
      )}

      {/* Generate Contributions Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Contributions</h3>
            <p className="text-gray-600 mb-6">
              Generate contributions for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateContributions}
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

export default ContributionManagement;