import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { customerService } from '../../services/customerService';

interface Contribution {
  id: number;
  contribution_month: string;
  amount_required: number;
  amount_paid: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_date?: string;
  fines_applied: number;
  created_at: string;
}

const CustomerContributions: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { addToast } = useToast();

  useEffect(() => {
    fetchContributions();
  }, [selectedYear]);

  const fetchContributions = async () => {
    try {
      const response = await customerService.getContributions({ year: selectedYear });
      setContributions(response.data.data?.contributions || []);
    } catch (error) {
      addToast('Failed to fetch contributions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `KES ${amount.toFixed(2)}`;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Contributions</h1>
          <p className="text-gray-600 mt-1">View and manage your monthly contributions</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Contributions List */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="px-6 py-4 border-b border-white/30">
          <h3 className="text-lg font-semibold text-gray-900">Contributions for {selectedYear}</h3>
        </div>
        
        {contributions.length > 0 ? (
          <div className="divide-y divide-white/30">
            {contributions.map((contribution) => {
              const totalAmount = contribution.amount_required + (contribution.fines_applied || 0);
              return (
                <div key={contribution.id} className="p-6 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {new Date(contribution.contribution_month).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric'
                        })}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Due: {new Date(contribution.due_date).toLocaleDateString()}
                      </p>
                      {contribution.paid_date && (
                        <p className="text-sm text-green-600">
                          Paid: {new Date(contribution.paid_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                          contribution.status === 'paid' ? 'bg-green-100 text-green-800' :
                          contribution.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          contribution.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {contribution.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </p>
                      {contribution.fines_applied > 0 && (
                        <p className="text-sm text-red-600">
                          (includes {formatCurrency(contribution.fines_applied)} late fee)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No contributions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No contributions available for {selectedYear}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerContributions;
