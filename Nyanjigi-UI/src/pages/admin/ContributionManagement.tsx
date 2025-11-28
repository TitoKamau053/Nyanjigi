import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Calendar, TrendingUp, Plus, Download } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

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
}

const ContributionManagement: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchContributions();
  }, [selectedMonth]);

  const fetchContributions = async () => {
    try {
      const response = await adminService.getContributions({ month: selectedMonth });
      const allContributions = response.data?.data?.contributions || [];

      // Filter contributions by selected month as fallback (API should handle this, but adding client-side filtering)
      const filteredContributions = allContributions.filter((contribution: Contribution) => {
        const contributionDate = new Date(contribution.contribution_month);
        const contributionMonth = contributionDate.getFullYear() + '-' +
          String(contributionDate.getMonth() + 1).padStart(2, '0');
        return contributionMonth === selectedMonth;
      });

      setContributions(filteredContributions);
    } catch (error) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAmount = contributions.reduce((sum, contrib) => sum + Number(contrib.amount_required || 0), 0);
  const paidAmount = contributions.filter(c => c.display_status === 'paid').reduce((sum, contrib) => sum + Number(contrib.amount_paid || 0), 0);
  const pendingAmount = contributions.filter(c => c.display_status === 'pending').reduce((sum, contrib) => sum + Number(contrib.amount_required || 0), 0);
  const overdueAmount = contributions.filter(c => c.display_status === 'overdue').reduce((sum, contrib) => sum + Number(contrib.amount_required || 0), 0);

  const collectionRate = contributions.length > 0 ? (contributions.filter(c => c.display_status === 'paid').length / contributions.length * 100) : 0;

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
              <p className="text-sm text-gray-600">Total Expected</p>
              <p className="text-2xl font-bold text-gray-900">KES {totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Collected</p>
              <p className="text-2xl font-bold text-gray-900">KES {paidAmount.toLocaleString()}</p>
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
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">{Math.round(collectionRate)}%</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Collection Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(collectionRate)}%</p>
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
                  Paid Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contributions.map((contribution) => (
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
                    <div className="text-sm font-medium text-gray-900">KES {Number(contribution.amount_required || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{new Date(contribution.due_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contribution.display_status)}`}>
                      {contribution.display_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {contribution.paid_date ? new Date(contribution.paid_date).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors">
                        View
                      </button>
                      {contribution.display_status !== 'paid' && (
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
              ))}
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