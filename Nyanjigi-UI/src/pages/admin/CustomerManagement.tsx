import { useState, useEffect } from 'react';
import { Users, Plus, ToggleLeft, ToggleRight, RefreshCw, Wallet } from 'lucide-react';
import useServerSearch from '../../hooks/useServerSearch';
import SearchBar from '../../components/common/SearchBar';
import PaginationControls from '../../components/common/PaginationControls';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

// ---------------------------------------------------------------------------
// Types & Adapters
// ---------------------------------------------------------------------------

interface Customer {
  id: number;
  account_number?: string;
  accountNumber?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  email?: string | null;
  phone?: string;
  phone_number?: string;
  phoneNumber?: string;
  contact?: string;
  location?: string;
  zone?: 'Nyakahura' | 'G3' | 'Githunguri' | string;
  customer_type?: 'normal' | 'institution';
  customerType?: 'normal' | 'institution';
  status?: 'active' | 'inactive' | string;
  is_active?: boolean;
  isActive?: boolean;
  connection_date?: string;
  connectionDate?: string;
  last_payment_date?: string;
  
  // Ledger Balance Fields
  total_debt?: number;
  totalDebt?: number;
  outstanding_balance?: number;
  outstandingBalance?: number;
  current_balance?: number;
  currentBalance?: number;
  account_balance?: number;
  accountBalance?: number;
}

// Safely maps backend keys (snake_case OR camelCase) to ensure the UI always has data
const getCustomerData = (c: Customer) => {
  // We prioritize total_debt here to ensure the full ledger debt is what shows on the UI
  const balance = c.total_debt ?? c.totalDebt ?? c.outstanding_balance ?? c.outstandingBalance ?? c.current_balance ?? c.currentBalance ?? c.account_balance ?? c.accountBalance ?? 0;
  const rawStatus = c.status || (c.is_active || c.isActive ? 'active' : 'inactive');
  
  return {
    id: c.id,
    fullName: c.full_name || c.fullName || c.name || 'Unknown',
    accountNumber: c.account_number || c.accountNumber || 'N/A',
    phone: c.phone || c.phone_number || c.phoneNumber || c.contact || 'N/A',
    email: c.email || 'N/A',
    location: c.location || 'N/A',
    zone: c.zone || 'N/A',
    customerType: c.customer_type || c.customerType || 'normal',
    connectionDate: c.connection_date || c.connectionDate || new Date().toISOString(),
    status: rawStatus.toLowerCase(),
    balance: Number(balance)
  };
};
// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

const AdjustBalanceModal = ({ 
  customer, onClose, onSuccess 
}: { 
  customer: Customer | null; 
  onClose: () => void; 
  onSuccess: () => void; 
}) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit'); 
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  if (!customer) return null;
  const cData = getCustomerData(customer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
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
          For: <span className="font-bold">{cData.fullName}</span>
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

const AddCustomerModal = ({ 
  onClose, onCustomerAdded 
}: { 
  onClose: () => void; 
  onCustomerAdded: () => void 
}) => {
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
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

  const [initialBalance, setInitialBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'none' | 'debt' | 'credit'>('none');

  const handleZoneChange = (newZone: 'Nyakahura' | 'G3' | 'Githunguri') => {
    setZone(newZone);
    switch (newZone) {
      case 'Nyakahura': setAccountNumber('NyWs-0'); break;
      case 'G3': setAccountNumber('NyWs-00'); break;
      case 'Githunguri': setAccountNumber('NyWs-000'); break;
      default: setAccountNumber('NyWs-');
    }
  };

  const validateForm = () => {
    if (!zone || !['Nyakahura', 'G3', 'Githunguri'].includes(zone)) {
      setError('Please select a valid zone');
      return false;
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
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
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to add customer';
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
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value) && value.length <= 10) {
                    setPhone(value);
                  }
                }}
                placeholder="07xxxxxxxx" 
                required pattern="^\d{10}$"
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

const ViewCustomerModal = ({ 
  customer, onClose 
}: { 
  customer: Customer | null; 
  onClose: () => void 
}) => {
  if (!customer) return null;
  const cData = getCustomerData(customer);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Customer Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <p className="text-sm text-gray-900">{cData.accountNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                cData.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {cData.status}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <p className="text-sm text-gray-900">{cData.fullName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-900">{cData.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="text-sm text-gray-900">{cData.phone}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <p className="text-sm text-gray-900">{cData.location}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Zone</label>
              <p className="text-sm text-gray-900">{cData.zone}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Type</label>
              <p className="text-sm text-gray-900 capitalize">{cData.customerType}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Connection Date</label>
            <p className="text-sm text-gray-900">
              {new Date(cData.connectionDate).toLocaleDateString()}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Outstanding Balance</label>
            <p className={`text-sm font-semibold ${
               cData.balance > 0 
                 ? 'text-red-600' 
                 : cData.balance < 0 
                   ? 'text-green-600' 
                   : 'text-gray-900'
            }`}>
              {cData.balance > 0 
                 ? `Debt: KES ${cData.balance.toLocaleString()}` 
                 : cData.balance < 0 
                    ? `Overpaid: KES ${Math.abs(cData.balance).toLocaleString()}` 
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const CustomerManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null);
  
  const [selectedZone, setSelectedZone] = useState<'Nyakahura' | 'G3' | 'Githunguri' | ''>('');
  
  const { addToast } = useToast();

  const {
    data: customers,
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
    loading: serverLoading,
    refresh,
  } = useServerSearch<Customer>((params) => adminService.getCustomers({ page: params.page, limit: params.limit, search: params.search, zone: selectedZone || undefined }), { initialPage: 1, initialLimit: 10 });

  useEffect(() => {
    setLoading(serverLoading);
  }, [serverLoading]);

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone as 'Nyakahura' | 'G3' | 'Githunguri' | '');
    setCurrentPage(1);
  };

  const toggleCustomerStatus = async (customerId: number) => {
    try {
      await adminService.toggleCustomerStatus(customerId);
      refresh();
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

  if (loading && (!customers || customers.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-gray-600">Loading customers and calculating outstanding balances...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage water service customers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refresh()}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2">
          <SearchBar
            value={searchTerm}
            onChange={(e: { target: { value: string; }; }) => setSearchTerm(e.target.value)}
            placeholder="Search by name, account, or email..."
          />
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
              <p className="text-2xl font-bold text-gray-900">{totalItems || 0}</p>
            </div>
          </div>
        </div>
      </div>

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
              {(customers || []).map((customer) => {
                const cData = getCustomerData(customer);
                return (
                  <tr key={cData.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cData.fullName}</div>
                        <div className="text-sm text-gray-500">{cData.location}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{cData.accountNumber}</div>
                      <div className="text-sm text-gray-500">
                        Connected: {new Date(cData.connectionDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{cData.zone}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cData.customerType === 'institution'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {cData.customerType === 'institution' ? '🏢 Institution' : '👤 Normal'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{cData.email !== 'N/A' ? cData.email : ''}</div>
                      <div className="text-sm text-gray-500">{cData.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        cData.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {cData.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        cData.balance > 0 
                          ? 'text-red-600' 
                          : cData.balance < 0 
                            ? 'text-green-600' 
                            : 'text-gray-500'
                      }`}>
                        {cData.balance > 0 
                          ? `KES ${cData.balance.toLocaleString()}` 
                          : cData.balance < 0 
                            ? `Overpaid: KES ${Math.abs(cData.balance).toLocaleString()}`
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
                          onClick={() => toggleCustomerStatus(cData.id)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Toggle Status"
                        >
                          {cData.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
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

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPageChange={(n: number) => setCurrentPage(n)}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n: number) => setItemsPerPage(n)}
        totalItems={totalItems}
      />

      {totalItems === 0 && (
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
          onCustomerAdded={() => refresh()}
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
          onSuccess={() => refresh()}
        />
      )}
    </div>
  );
};

export default CustomerManagement;