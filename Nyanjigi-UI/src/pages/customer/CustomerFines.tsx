import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { customerService } from '../../services/customerService';

interface Fine {
  id: number;
  customer_id: number;
  bill_id: number | null;
  fine_type_id: number;
  amount: string;
  reason: string;
  applied_date: string;
  status: string;
  waived_by: number | null;
  waived_reason: string | null;
  created_at: string;
  fine_name: string;
  fine_type: string;
}

const CustomerFines: React.FC = () => {
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    fetchFines();
  }, []);

  const fetchFines = async () => {
    try {
      const response = await customerService.getFines?.();
      setFines(response?.data?.data || []);
    } catch (error) {
      console.error('Error fetching fines:', error);
      addToast('Failed to fetch fines', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `KES ${num.toFixed(2)}`;
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
          <h1 className="text-3xl font-bold text-gray-900">My Fines</h1>
          <p className="text-gray-600 mt-1">View and manage your fines</p>
        </div>
      </div>

      {/* Fines List */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="px-6 py-4 border-b border-white/30">
          <h3 className="text-lg font-semibold text-gray-900">Fines</h3>
        </div>
        
        {fines.length > 0 ? (
          <div className="divide-y divide-white/30">
            {fines.map((fine) => (
              <div key={fine.id} className="p-6 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Fine: {fine.fine_name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Reason: {fine.reason}
                    </p>
                    <p className="text-sm text-gray-600">
                      Applied: {new Date(fine.applied_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                      fine.status === 'paid' ? 'bg-green-100 text-green-800' :
                      fine.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      fine.status === 'waived' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {fine.status.toUpperCase()}
                    </span>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(fine.amount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No fines found</h3>
            <p className="mt-1 text-sm text-gray-500">
              You have no fines at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerFines;
