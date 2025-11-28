/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Customer {
  id: number;
  account_number: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  zone: 'Nyakahura' | 'G3' | 'Githunguri';
  customer_type: 'normal' | 'institution';
  status: 'active' | 'inactive';
  connection_date: string;
  last_payment_date?: string;
  outstanding_balance: number;
}

interface ApiCustomer {
  id: number;
  account_number: string;
  full_name: string;
  phone: string;
  email: string;
  location: string;
  zone: 'Nyakahura' | 'G3' | 'Githunguri';
  customer_type: 'normal' | 'institution';
  meter_number: string | null;
  connection_date: string;
  is_active: number;
  created_at: string;
}

interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

const AddCustomerModal: React.FC<{ onClose: () => void; onCustomerAdded: () => void }> = ({ onClose, onCustomerAdded }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [zone, setZone] = useState<'Nyakahura' | 'G3' | 'Githunguri'>('Nyakahura');
  const [connectionDate, setConnectionDate] = useState('');
  const [customerType, setCustomerType] = useState<'normal' | 'institution'>('normal');
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const validateForm = () => {
    if (!zone || !['Nyakahura', 'G3', 'Githunguri'].includes(zone)) {
      setError('Please select a valid zone');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setSmsStatus('idle');
    setGeneratedPassword('');
    try {
      const response = await adminService.createCustomer({
        full_name: fullName,
        phone,
        email,
        location,
        zone,
        connection_date: connectionDate,
        customer_type: customerType,
      });

      // Extract temporary password from API response
      const tempPassword = response.data.data?.temporary_password || response.data.temporary_password;
      if (tempPassword) {
        setGeneratedPassword(tempPassword);
        setSmsStatus('sending');

        // Send SMS with password to customer
        try {
          await adminService.sendCustomerPassword(phone, tempPassword);
          setSmsStatus('success');
          addToast('Customer added successfully and password sent via SMS', 'success');
        } catch (smsError) {
          setSmsStatus('error');
          addToast('Customer added successfully but SMS failed. Please provide password manually.', 'warning');
        }
      } else {
        addToast('Customer added successfully', 'success');
      }

      onCustomerAdded();
    } catch (error: any) {
      if (error.response?.data?.errors?.zone) {
        setError(error.response.data.errors.zone[0]);
      } else {
        addToast('Failed to add customer', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter customer's full name"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as 'Nyakahura' | 'G3' | 'Githunguri')}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="Nyakahura">Nyakahura</option>
              <option value="G3">G3</option>
              <option value="Githunguri">Githunguri</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Connection Date</label>
            <input
              type="date"
              value={connectionDate}
              onChange={(e) => setConnectionDate(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as 'normal' | 'institution')}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="normal">Normal</option>
              <option value="institution">Institution</option>
            </select>
          </div>

          {generatedPassword && (
            <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Generated Password:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono bg-white p-2 rounded border flex-1">{generatedPassword}</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(generatedPassword)}
                      className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                      title="Copy password"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm">
                {smsStatus === 'sending' && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p>Sending password to customer via SMS...</p>
                  </div>
                )}
                {smsStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-green-500">✓</span>
                    <p>Password sent successfully to {phone}</p>
                  </div>
                )}
                {smsStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <span className="text-red-500">⚠</span>
                    <p>Failed to send SMS. Please provide password manually to customer.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          <div className="flex justify-end space-x-2">
            {generatedPassword ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Customer'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const ViewCustomerModal: React.FC<{ 
  customer: Customer | null; 
  onClose: () => void 
}> = ({ customer, onClose }) => {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Customer Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <p className="text-sm text-gray-900">{customer.account_number}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                customer.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {customer.status}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <p className="text-sm text-gray-900">{customer.full_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-900">{customer.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="text-sm text-gray-900">{customer.phone}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <p className="text-sm text-gray-900">{customer.location}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Zone</label>
              <p className="text-sm text-gray-900">{customer.zone}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Type</label>
              <p className="text-sm text-gray-900 capitalize">{customer.customer_type}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Connection Date</label>
            <p className="text-sm text-gray-900">
              {new Date(customer.connection_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Outstanding Balance</label>
            <p className={`text-sm font-semibold ${
              customer.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              KES {customer.outstanding_balance.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await adminService.getCustomers();
      const apiData = response.data.data || response.data;
      const customersList = apiData.customers || [];
      
      // Fetch all bills, contributions, and fines once
      const [billsResponse, contributionsResponse, finesResponse] = await Promise.all([
        adminService.getBills({ limit: 1000 }),
        adminService.getContributions({ limit: 1000 }),
        adminService.getFines()
      ]);

      const bills = billsResponse.data.data?.bills || billsResponse.data.bills || [];
      const contributions = contributionsResponse.data.data?.contributions || contributionsResponse.data.contributions || [];
      const fines = finesResponse.data.data?.fines || finesResponse.data.fines || [];

      // Calculate outstanding balances for all customers efficiently
      const customersWithBalances = customersList.map((customer: ApiCustomer) => {
        // Filter for this specific customer
        const customerBills = bills.filter((bill: any) => bill.customer_id === customer.id);
        const customerContributions = contributions.filter((contribution: any) => contribution.customer_id === customer.id);
        const customerFines = fines.filter((fine: any) => fine.customer_id === customer.id);

        // Calculate outstanding amounts
        const outstandingBills = customerBills
          .filter((bill: any) => bill.status !== 'paid')
          .reduce((sum: number, bill: any) => sum + (Number(bill.total_amount) || 0), 0);

        const outstandingContributions = customerContributions
          .filter((contribution: any) => contribution.status !== 'paid')
          .reduce((sum: number, contribution: any) => sum + (Number(contribution.amount) || 0), 0);

        const outstandingFines = customerFines
          .filter((fine: any) => fine.status !== 'paid')
          .reduce((sum: number, fine: any) => sum + (Number(fine.amount) || 0), 0);

        const outstandingBalance = outstandingBills + outstandingContributions + outstandingFines;

        return {
          ...customer,
          status: customer.is_active === 1 ? 'active' : 'inactive',
          outstanding_balance: outstandingBalance,
          last_payment_date: null, // Default value since not provided by API
        };
      });

      const paginationData = apiData.pagination || null;
      setCustomers(customersWithBalances);
      setPagination(paginationData);
    } catch (error) {
      console.error('Error fetching customers with outstanding balances:', error);
      addToast('Failed to fetch customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCustomerStatus = async (customerId: number) => {
    try {
      await adminService.toggleCustomerStatus(customerId);
      await fetchCustomers();
      addToast('Customer status updated successfully', 'success');
    } catch (error) {
      addToast('Failed to update customer status', 'error');
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-gray-600">Loading customers and calculating outstanding balances...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage water service customers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchCustomers}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            title="Refresh and recalculate outstanding balances"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <div className="flex items-center gap-3">
            <ToggleRight className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 overflow-hidden">
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
                Zone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{customer.full_name}</div>
                      <div className="text-sm text-gray-500">{customer.location}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{customer.account_number}</div>
                    <div className="text-sm text-gray-500">
                      Connected: {new Date(customer.connection_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{customer.zone}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        customer.customer_type === 'institution'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {customer.customer_type === 'institution' ? '🏢 Institution' : '👤 Normal'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.email}</div>
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      customer.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      KES {customer.outstanding_balance.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewCustomer(customer)}
                        className="text-green-600 hover:text-green-900 transition-colors"
                        title="View Details"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleCustomerStatus(customer.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Toggle Status"
                      >
                        {customer.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding a new customer.'}
          </p>
        </div>
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCustomerAdded={fetchCustomers}
        />
      )}

      {showViewModal && (
        <ViewCustomerModal
          customer={selectedCustomer}
          onClose={() => {
            setShowViewModal(false);
            setSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomerManagement;