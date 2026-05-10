/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Plus, ToggleLeft, ToggleRight, RefreshCw, Wallet } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Customer {
  id: number;
  account_number: string;
  full_name: string;
  email: string | null;
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
  email: string | null;
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

const AdjustBalanceModal: React.FC<{ 
  customer: Customer | null; 
  onClose: () => void;
  onSuccess: () => void;
}> = ({ customer, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit'); 
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  if (!customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Debit (Owe) = Positive, Credit (Overpaid) = Negative
      const finalAmount = type === 'debit' ? parseFloat(amount) : -parseFloat(amount);
      await adminService.adjustCustomerBalance(customer.id, { amount: finalAmount, notes });
      addToast('Balance adjusted successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to adjust balance', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-4">Adjust Balance</h2>
        <p className="text-sm text-gray-600 mb-4">
          For: <span className="font-bold">{customer.full_name}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Action Type</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setType('debit')}
                className={`flex-1 py-2 rounded text-sm font-medium border ${
                  type === 'debit' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                Add Debt (Bill)
              </button>
              <button
                type="button"
                onClick={() => setType('credit')}
                className={`flex-1 py-2 rounded text-sm font-medium border ${
                  type === 'credit' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                Add Credit (Payment)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              min="1"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes / Reason</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment..."
              rows={2}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddCustomerModal: React.FC<{ onClose: () => void; onCustomerAdded: () => void }> = ({ onClose, onCustomerAdded }) => {
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  // Default to Nyakahura prefix (NyWs-0)
  const [accountNumber, setAccountNumber] = useState('NyWs-0');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [zone, setZone] = useState<'Nyakahura' | 'G3' | 'Githunguri'>('Nyakahura');
  const [connectionDate, setConnectionDate] = useState('');
  const [customerType, setCustomerType] = useState<'normal' | 'institution'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  // New state for opening balance
  const [initialBalance, setInitialBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'none' | 'debt' | 'credit'>('none');

  // Handle Zone Change to pre-apply specific zero-padding prefix
  const handleZoneChange = (newZone: 'Nyakahura' | 'G3' | 'Githunguri') => {
    setZone(newZone);
    // Set specific prefix based on zone as requested
    switch (newZone) {
      case 'Nyakahura':
        setAccountNumber('NyWs-0');
        break;
      case 'G3':
        setAccountNumber('NyWs-00');
        break;
      case 'Githunguri':
        setAccountNumber('NyWs-000');
        break;
      default:
        setAccountNumber('NyWs-');
    }
  };

  const validateForm = () => {
    if (!zone || !['Nyakahura', 'G3', 'Githunguri'].includes(zone)) {
      setError('Please select a valid zone');
      return false;
    }
    // Ensure account number has the correct prefix format and ends with digits
    // Allows NyWs-01, NyWs-001, NyWs-0001 etc.
    if (!/^NyWs-0+\d+$/.test(accountNumber)) {
        setError('Account number must match the zone format (e.g., NyWs-0... for Nyakahura)');
        return false;
    }
    if (!nationalId.trim()) {
        setError('National ID is required');
        return false;
    }
    setError('');
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const value = e.target.value; // Allow only digits and max 10 characters 
     if (/^\d*$/.test(value) && value.length <= 10) { setPhone(value); 
     } 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Calculate signed initial balance
      let signedBalance = 0;
      if (balanceType === 'debt') signedBalance = parseFloat(initialBalance);
      if (balanceType === 'credit') signedBalance = -parseFloat(initialBalance);

      await adminService.createCustomer({
        full_name: fullName,
        national_id: nationalId,
        account_number: accountNumber,
        phone,
        email: email || undefined,
        location,
        zone,
        connection_date: connectionDate,
        customer_type: customerType,
        initial_balance: signedBalance
      });

      addToast(`Customer added. Password set to ID: ${nationalId}`, 'success');
      onCustomerAdded();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to add customer';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Zone and Account Number Group */}
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-3">
             <div>
                <label className="block text-sm font-medium text-gray-700">Zone</label>
                <select
                value={zone}
                onChange={(e) => handleZoneChange(e.target.value as 'Nyakahura' | 'G3' | 'Githunguri')}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white"
                >
                <option value="Nyakahura">Nyakahura (Code: 0)</option>
                <option value="G3">G3 (Code: 00)</option>
                <option value="Githunguri">Githunguri (Code: 000)</option>
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="block w-full border border-gray-300 rounded-md p-2 font-mono"
                    />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {zone === 'Nyakahura' && 'Format: NyWs-0[Number]'}
                    {zone === 'G3' && 'Format: NyWs-00[Number]'}
                    {zone === 'Githunguri' && 'Format: NyWs-000[Number]'}
                </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">National ID (Used as Password)</label>
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="12345678"
              required
              pattern="^[0-9]{5,8}$" 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div> <label className="block text-sm font-medium text-gray-700">Phone</label> 
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="07xxxxxxxx" 
                required pattern="^\d{10}$" // expects exactly 10 digits 
                className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                /> 
              </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                />
            </div>
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
          
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* OPENING BALANCE SECTION */}
          <div className="p-3 bg-blue-50 rounded-md border border-blue-100 space-y-3 mt-4">
            <h3 className="text-sm font-semibold text-blue-800">Opening Balance (Optional)</h3>
            <div className="flex gap-2">
               <label className="flex items-center text-sm cursor-pointer">
                 <input 
                   type="radio" 
                   checked={balanceType === 'none'} 
                   onChange={() => setBalanceType('none')} 
                   className="mr-1"
                  /> 
                  None (0.00)
               </label>
               <label className="flex items-center text-sm text-red-700 cursor-pointer">
                 <input 
                   type="radio" 
                   checked={balanceType === 'debt'} 
                   onChange={() => setBalanceType('debt')} 
                   className="mr-1"
                  /> 
                  Has Debt (Bill)
               </label>
               <label className="flex items-center text-sm text-green-700 cursor-pointer">
                 <input 
                   type="radio" 
                   checked={balanceType === 'credit'} 
                   onChange={() => setBalanceType('credit')} 
                   className="mr-1"
                  /> 
                  Overpaid (Credit)
               </label>
            </div>
            {balanceType !== 'none' && (
                <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                      {balanceType === 'debt' ? 'Amount Owed (Debt)' : 'Amount Overpaid (Credit)'}
                   </label>
                   <input
                      type="number"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="Enter amount"
                      className="block w-full border border-blue-300 rounded-md p-2 text-sm"
                      required
                   />
                </div>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-200">{error}</div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border"
                disabled={loading}
            >
                Cancel
            </button>
            <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                disabled={loading}
            >
                {loading ? 'Adding...' : 'Add Customer'}
            </button>
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
          
          {/* UPDATED: Balance Display in View Modal */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Outstanding Balance</label>
            <p className={`text-sm font-semibold ${
               customer.outstanding_balance > 0 
                 ? 'text-red-600' 
                 : customer.outstanding_balance < 0 
                   ? 'text-green-600' 
                   : 'text-gray-900'
            }`}>
              {customer.outstanding_balance > 0 
                 ? `Debt: KES ${customer.outstanding_balance.toLocaleString()}` 
                 : customer.outstanding_balance < 0 
                    ? `Overpaid: KES ${Math.abs(customer.outstanding_balance).toLocaleString()}` 
                    : 'KES 0'}
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
  // Master list of all calculated customers
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  // Currently displayed customers (after filter & pagination)
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedZone, setSelectedZone] = useState<'Nyakahura' | 'G3' | 'Githunguri' | ''>('');
  
  const { addToast } = useToast();

  // 1. FETCH EVERYTHING EXACTLY ONCE
  useEffect(() => {
    fetchInitialData();
  }, []);

const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL customers and ALL financial records concurrently
      const [customersRes, billsRes, contribsRes, finesRes, paymentsRes] = await Promise.all([
        adminService.getCustomers({ page: 1, limit: 2000 }), 
        adminService.getBills({ limit: 2000 }),
        adminService.getContributions({ limit: 2000 }),
        adminService.getFines({ limit: 2000 }),
        adminService.getPayments({ limit: 10000 })
      ]);

      const apiData = customersRes.data.data || customersRes.data;
      const customersList = apiData.customers || [];
      
      const bills = billsRes.data.data?.bills || billsRes.data.bills || [];
      const contributions = contribsRes.data.data?.contributions || contribsRes.data.contributions || [];
      const fines = finesRes.data.data?.fines || finesRes.data.fines || [];
      const payments = paymentsRes.data.data?.payments || paymentsRes.data.payments || [];

      // Calculate Net Balance = (Total Charges) - (Total Payments)
      const customersWithBalances = customersList.map((customer: ApiCustomer) => {
        const customerBills = bills.filter((bill: any) => bill.customer_id === customer.id);
        const customerContributions = contributions.filter((c: any) => c.customer_id === customer.id);
        const customerFines = fines.filter((fine: any) => fine.customer_id === customer.id);
        const customerPayments = payments.filter((p: any) => p.customer_id === customer.id && p.status === 'completed');

        const totalBills = customerBills.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
        const totalContribs = customerContributions.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
        const totalFines = customerFines.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
        const totalPaid = customerPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

        const netBalance = (totalBills + totalContribs + totalFines) - totalPaid;

        return {
          ...customer,
          status: customer.is_active === 1 ? 'active' : 'inactive',
          outstanding_balance: netBalance,
          last_payment_date: null,
        };
      });

      // Store the complete master list
      setAllCustomers(customersWithBalances);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      addToast('Failed to fetch customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. CLIENT-SIDE FILTERING & PAGINATION
  // This runs instantly in-memory whenever search, zone, or page changes.
  useEffect(() => {
    let filtered = allCustomers;

    // Apply Search Filter
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.full_name.toLowerCase().includes(lowerTerm) ||
        c.account_number.toLowerCase().includes(lowerTerm) ||
        (c.email && c.email.toLowerCase().includes(lowerTerm))
      );
    }

    // Apply Zone Filter
    if (selectedZone) {
      filtered = filtered.filter(c => c.zone === selectedZone);
    }

    // Calculate Pagination Details
    const total = filtered.length;
    const total_pages = Math.ceil(total / itemsPerPage);
    
    // Ensure currentPage isn't out of bounds if filtering reduces the total pages
    const validPage = Math.max(1, Math.min(currentPage, Math.max(1, total_pages)));
    if (validPage !== currentPage) {
      setCurrentPage(validPage);
      return; // The state update will re-trigger this effect
    }

    // Slice the array for the current page
    const startIndex = (validPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    setCustomers(paginated);
    setPagination({
      current_page: validPage,
      per_page: itemsPerPage,
      total: total,
      total_pages: total_pages,
      has_next: validPage < total_pages,
      has_prev: validPage > 1,
    });
  }, [allCustomers, searchTerm, selectedZone, currentPage, itemsPerPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page
  };

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone as 'Nyakahura' | 'G3' | 'Githunguri' | '');
    setCurrentPage(1); // Reset to first page
  };

  const handleItemsPerPageChange = (newPerPage: number) => {
    setItemsPerPage(newPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const toggleCustomerStatus = async (customerId: number) => {
    try {
      await adminService.toggleCustomerStatus(customerId);
      // Re-fetch everything to ensure sync with DB after a mutation
      fetchInitialData();
      addToast('Customer status updated successfully', 'success');
    } catch (error) {
      addToast('Failed to update customer status', 'error');
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  const handleAdjustBalance = (customer: Customer) => {
    setAdjustCustomer(customer);
    setShowAdjustModal(true);
  };

  if (loading && allCustomers.length === 0) {
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
            onClick={() => fetchInitialData()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            title="Refresh and recalculate outstanding balances from Server"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Search, Filter and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, account, or email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <select
            value={selectedZone}
            onChange={(e) => handleZoneChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Zones</option>
            <option value="Nyakahura">Nyakahura</option>
            <option value="G3">G3</option>
            <option value="Githunguri">Githunguri</option>
          </select>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Filtered</p>
              <p className="text-2xl font-bold text-gray-900">{pagination?.total || 0}</p>
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
              {customers.map((customer) => (
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

                  {/* Balance Display Logic */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      customer.outstanding_balance > 0 
                        ? 'text-red-600' 
                        : customer.outstanding_balance < 0 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                    }`}>
                      {customer.outstanding_balance > 0 
                        ? `KES ${customer.outstanding_balance.toLocaleString()}` 
                        : customer.outstanding_balance < 0 
                          ? `Overpaid: KES ${Math.abs(customer.outstanding_balance).toLocaleString()}`
                          : 'KES 0'}
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
                        onClick={() => handleAdjustBalance(customer)}
                        className="text-purple-600 hover:text-purple-900 transition-colors"
                        title="Adjust Balance"
                      >
                        <Wallet className="w-4 h-4" />
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

      {/* Pagination Controls */}
      {pagination && (
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
              Showing {pagination.total === 0 ? 0 : (pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} results
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                    onClick={() => setCurrentPage(page)}
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.total_pages))}
              disabled={!pagination.has_next}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {customers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || selectedZone ? 'Try adjusting your search or filter terms.' : 'Get started by adding a new customer.'}
          </p>
        </div>
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCustomerAdded={() => fetchInitialData()}
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

      {showAdjustModal && (
        <AdjustBalanceModal
          customer={adjustCustomer}
          onClose={() => {
            setShowAdjustModal(false);
            setAdjustCustomer(null);
          }}
          onSuccess={() => fetchInitialData()}
        />
      )}
    </div>
  );
};

export default CustomerManagement;