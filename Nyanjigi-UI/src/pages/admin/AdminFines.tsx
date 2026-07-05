import React, { useState, useEffect, useMemo } from 'react';
import { FileText } from 'lucide-react';
import SearchBar from '../../components/common/SearchBar';
import PaginationControls from '../../components/common/PaginationControls';
import useClientSearch from '../../hooks/useClientSearch';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';

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
  full_name: string;
  account_number: string;
}

const AdminFines: React.FC = () => {
  const [allFines, setAllFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchFines();
  }, []);

  const fetchFines = async () => {
    try {
      setLoading(true);
      const allFetchedFines: Fine[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const response = await adminService.getFines?.({ page: currentPage, limit: 100 });
        const apiData = response?.data?.data || response?.data;
        const finesData = apiData.fines || apiData || [];

        allFetchedFines.push(...finesData);
        totalPages = apiData.pagination?.total_pages || 1;
        currentPage += 1;
      } while (currentPage <= totalPages);

      setAllFines(allFetchedFines);
    } catch (error) {
      console.error('Error fetching fines:', error);
      addToast('Failed to fetch fines', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
  };

  const statusFilteredFines = useMemo(() => {
    return allFines.filter((fine) => {
      if (statusFilter !== 'all' && fine.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allFines, statusFilter]);

  const {
    paginatedData: fines,
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
  } = useClientSearch<Fine>(statusFilteredFines, ['full_name', 'account_number', 'fine_name', 'reason'], 10);

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
          <h1 className="text-3xl font-bold text-gray-900">Fines Management</h1>
          <p className="text-gray-600 mt-1">View and manage fines for all customers</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SearchBar value={searchTerm} onChange={handleSearchChange} placeholder="Search by customer name or account..." />
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
            <option value="waived">Waived</option>
          </select>
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
                      {fine.full_name} - Account: {fine.account_number}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Fine Type: {fine.fine_name}
                    </p>
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
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filter terms.' : 'No fines available at this time.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
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
      </div>
  );
};

export default AdminFines;
