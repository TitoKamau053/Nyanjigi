import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface CustomerReading {
  customer_id: number;
  account_number: string;
  full_name: string;
  location: string;
  meter_number: string | null;
  previous_reading: string | number;
  already_recorded_reading: string | number | null;
}

interface ReadingModalData {
  customer: CustomerReading | null;
  isOpen: boolean;
  currentReading: string;
}

export default function MeterReadings() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [customers, setCustomers] = useState<CustomerReading[]>([]);
  const [readings, setReadings] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalData, setModalData] = useState<ReadingModalData>({
    customer: null,
    isOpen: false,
    currentReading: ''
  });
  const { addToast } = useToast();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getMeterReadingCustomers({ month: month.slice(0, 7) });
      const customersData = res.data.data || res.data.customers || [];
      setCustomers(customersData);
      
      const initialReadings: Record<number, string> = {};
      customersData.forEach((c: CustomerReading) => {
        if (c.already_recorded_reading !== null) {
          initialReadings[c.customer_id] = String(c.already_recorded_reading);
        }
      });
      setReadings(initialReadings);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to fetch customers', 'error');
      setCustomers([]);
      setReadings({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchCustomers(); 
  }, [month]);

  const handleReadingChange = (customerId: number, value: string) => {
    setReadings(prev => ({ ...prev, [customerId]: value }));
  };

  const openModal = (customer: CustomerReading) => {
    setModalData({
      customer,
      isOpen: true,
      currentReading: readings[customer.customer_id] || ''
    });
  };

  const closeModal = () => {
    setModalData({ customer: null, isOpen: false, currentReading: '' });
  };

  const handleModalReadingChange = (value: string) => {
    setModalData(prev => ({ ...prev, currentReading: value }));
  };

  const handleModalSave = () => {
    if (!modalData.customer) return;
    
    const customerId = modalData.customer.customer_id;
    setReadings(prev => ({
      ...prev,
      [customerId]: modalData.currentReading
    }));
    closeModal();
  };

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.account_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.meter_number && c.meter_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleItemsPerPageChange = (newPerPage: number) => {
    setItemsPerPage(newPerPage);
    setCurrentPage(1);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = customers.map(c => ({
        customer_id: c.customer_id,
        previous_reading: c.previous_reading,
        current_reading: readings[c.customer_id] !== undefined ? readings[c.customer_id] : null
      })).filter(r => r.current_reading !== null && r.current_reading !== '');

      if (payload.length === 0) {
        addToast('No readings entered to save.', 'error');
        return;
      }

      const response = await adminService.saveMeterReadings({ 
        month: month.slice(0, 7), 
        readings: payload 
      });
      const successMessage = response.data?.message || `Successfully saved ${payload.length} meter readings!`;
      addToast(successMessage, 'success');
      await fetchCustomers(); 
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to save readings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Monthly Field Readings</h1>
          <p className="text-gray-600 mt-1">Record and manage meter readings for the month</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="month" 
            value={month.slice(0, 7)} 
            onChange={(e) => setMonth(e.target.value + '-01')} 
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button 
            onClick={handleSave} 
            disabled={isSaving || customers.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : 'Save Readings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search by customer name, meter number..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meter No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prev Reading</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Reading</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumption</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCustomers.map((c) => {
                 const current = parseFloat(readings[c.customer_id] || '0');
                 const previous = parseFloat(String(c.previous_reading || 0));
                 const consumption = current > previous ? (current - previous).toFixed(2) : '0.00';
                 
                 return (
                  <tr 
                    key={c.customer_id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openModal(c)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {c.account_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{c.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{previous.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="text-gray-800 font-medium">{readings[c.customer_id] || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {readings[c.customer_id] ? (
                         <span className={current < previous ? 'text-red-600' : 'text-green-600'}>
                           {consumption} units
                         </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {customers.length === 0 ? 'No active customers found for this month.' : 'No customers match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredCustomers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
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
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} results
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const showPage = 
                  page === 1 || 
                  page === totalPages || 
                  Math.abs(page - currentPage) <= 1;
                
                if (!showPage && (page === 2 || page === totalPages - 1)) {
                  return <span key={`ellipsis-${page}`} className="px-2 py-1">...</span>;
                }

                if (!showPage) return null;

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                      page === currentPage
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {customers.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No customers found for this month.</p>
        </div>
      )}

      {/* Reading Modal */}
      {modalData.isOpen && modalData.customer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Record Meter Reading</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Customer Name</label>
                <div className="p-3 bg-gray-100 rounded-lg text-gray-800 font-medium">
                  {modalData.customer.full_name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Meter Number</label>
                <div className="p-3 bg-gray-100 rounded-lg text-gray-800 font-medium">
                  {modalData.customer.account_number}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Previous Reading</label>
                <div className="p-3 bg-gray-100 rounded-lg text-gray-800 font-medium">
                  {parseFloat(String(modalData.customer.previous_reading)).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Current Reading *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter current meter reading"
                  value={modalData.currentReading}
                  onChange={(e) => handleModalReadingChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Total Consumption</label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-lg font-bold text-blue-600">
                    {modalData.currentReading 
                      ? (parseFloat(modalData.currentReading) - parseFloat(String(modalData.customer.previous_reading))).toFixed(2) 
                      : '0.00'} units
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                disabled={!modalData.currentReading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                Save Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}