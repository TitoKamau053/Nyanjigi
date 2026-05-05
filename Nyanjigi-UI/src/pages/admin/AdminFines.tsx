import React, { useState, useEffect } from 'react';
import { FileText, Search } from 'lucide-react';
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
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Pagination and filtering states
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchFines(1);
  }, []);

  const fetchFines = async (page: number = 1, search: string = '', status: string = 'all') => {
    try {
      setLoading(true);
      const params: any = {
        page,
        per_page: itemsPerPage,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (status !== 'all') {
        params.status = status;
      }

      const response = await adminService.getFines?.(params);
      const apiData = response?.data?.data || response?.data;
      const finesData = apiData.fines || apiData || [];
      const paginationData = apiData.pagination || null;

      setFines(finesData);
      setPagination(paginationData);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching fines:', error);
      addToast('Failed to fetch fines', 'error');
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
    fetchFines(page, searchTerm, statusFilter);
  };

  // Trigger search/filter whenever searchTerm, statusFilter, or itemsPerPage changes
  useEffect(() => {
    if (isSearching) {
      fetchFines(1, searchTerm, statusFilter);
      setIsSearching(false);
    }
  }, [searchTerm, statusFilter, itemsPerPage]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      {pagination && fines.length > 0 && (
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
      </div>
  );
};

export default AdminFines;
