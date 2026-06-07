/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Send,
  Bell,
  Search,
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

interface Customer {
  id: number;
  full_name: string;
  account_number: string;
  phone: string;
  zone: string;
}

interface NotificationResult {
  total: number;
  successful: number;
  failed: number;
  failed_details: Array<{
    customer_id: number;
    customer_name: string;
    phone: string;
    error: string;
  }>;
  notification_type: string;
  timestamp: string;
}

const AUTO_GENERATED_MESSAGES = {
  bill: 'Dear {customer_name}, your water bill for account {account_number} is due. Please pay at your earliest convenience. Thank you.',
  contribution: 'Dear {customer_name}, your monthly contribution for account {account_number} is due. Please remit payment. Thank you.',
  fine: 'Dear {customer_name}, a late payment fine has been applied to your account {account_number}. Please settle this immediately. Thank you.',
  overdue: 'Dear {customer_name}, your bill for account {account_number} is now overdue. Please make payment without further delay. Thank you.'
};

const NotificationManagement: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

  // Customer Selection State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  // Notification State
  const [notificationType, setNotificationType] = useState<'bill' | 'contribution' | 'fine' | 'overdue'>('bill');
  const [sendToAll, setSendToAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // UI State
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sendResults, setSendResults] = useState<NotificationResult | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await adminService.getCustomersForNotification({ page, limit: 100 });
      const data = response.data?.data?.customers || [];
      const pagination = response.data?.data?.pagination;
      
      if (page === 1) {
        setCustomers(data);
        setFilteredCustomers(data);
      } else {
        // Append to existing customers for pagination
        setCustomers(prev => [...prev, ...data]);
        setFilteredCustomers(prev => [...prev, ...data]);
      }
      
      if (pagination) {
        setCurrentPage(pagination.current_page);
        setTotalPages(pagination.total_pages);
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to fetch customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCustomers = async () => {
    if (currentPage < totalPages) {
      try {
        setLoading(true);
        const params: any = { page: currentPage + 1, limit: 100 };
        if (searchTerm) params.search = searchTerm;
        if (filterZone) params.zone = filterZone;
        
        const response = await adminService.getCustomersForNotification(params);
        const data = response.data?.data?.customers || [];
        const pagination = response.data?.data?.pagination;
        
        // Append to existing customers
        setCustomers(prev => [...prev, ...data]);
        setFilteredCustomers(prev => [...prev, ...data]);
        
        if (pagination) {
          setCurrentPage(pagination.page);
          setTotalPages(pagination.total_pages);
        }
      } catch (error: any) {
        addToast(error.response?.data?.message || 'Failed to load more customers', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    searchCustomers(term, filterZone);
  };

  const handleZoneFilter = (zone: string) => {
    setFilterZone(zone);
    setCurrentPage(1);
    searchCustomers(searchTerm, zone);
  };

  const searchCustomers = async (search: string, zone: string) => {
    try {
      setLoading(true);
      const params: any = { page: 1, limit: 100 };
      if (search) params.search = search;
      if (zone) params.zone = zone;
      
      const response = await adminService.getCustomersForNotification(params);
      const data = response.data?.data?.customers || [];
      const pagination = response.data?.data?.pagination;
      
      setCustomers(data);
      setFilteredCustomers(data);
      
      if (pagination) {
        setCurrentPage(pagination.page);
        setTotalPages(pagination.total_pages);
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to search customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomersList = (search: string, zone: string) => {
    let filtered = customers;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.full_name.toLowerCase().includes(searchLower) ||
          c.account_number.toLowerCase().includes(searchLower) ||
          c.phone.includes(search)
      );
    }

    if (zone) {
      filtered = filtered.filter(c => c.zone === zone);
    }

    setFilteredCustomers(filtered);
  };

  const handleSelectCustomer = (customerId: number) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
    setSelectAll(newSelected.size === filteredCustomers.length && filteredCustomers.length > 0);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredCustomers.map(c => c.id));
      setSelectedCustomers(allIds);
      setSelectAll(true);
    }
  };

  const getAutoGeneratedMessage = () => {
    return AUTO_GENERATED_MESSAGES[notificationType];
  };

  const generatePreviewMessage = () => {
    let preview = getAutoGeneratedMessage()
      .replace(/\{customer_name\}/g, '[Customer Name]')
      .replace(/\{account_number\}/g, '[Account #]')
      .replace(/\{phone\}/g, '[Phone]');

    if (preview.length > 160) {
      preview = preview.substring(0, 157) + '...';
    }

    return preview;
  };

  const handleSendNotifications = async () => {
    try {
      if (!sendToAll && selectedCustomers.size === 0) {
        addToast('Select at least one customer', 'error');
        return;
      }

      setLoading(true);

      const payload = {
        notification_type: notificationType,
        message: getAutoGeneratedMessage(),
        send_to_all: sendToAll,
        ...(! sendToAll && { customer_ids: Array.from(selectedCustomers) })
      };

      const response = await adminService.sendNotifications(payload);
      const results = response.data?.data;

      setSendResults(results);
      setShowResults(true);
      setShowPreview(false);

      // Reset form on success
      if (results.successful > 0) {
        setSelectedCustomers(new Set());
        setSelectAll(false);
        setSendToAll(false);
        addToast(
          `Notifications sent successfully! (${results.successful}/${results.total})`,
          'success'
        );
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getUniqZones = () => {
    const zones = new Set(customers.map(c => c.zone).filter(Boolean));
    return Array.from(zones).sort();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
          <div className="flex items-center gap-2 mt-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-gray-600">Manual SMS Notifications to Customers</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Manual Notifications Enabled</p>
          <p className="text-sm text-blue-700 mt-1">
            Automatic notifications are disabled. Use this page to send targeted SMS messages to
            customers about bills, contributions, or other important information.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1 inline-flex">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'send'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Send className="h-4 w-4" />
          Send Notifications
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Send History
        </button>
      </div>

      {/* Send Tab */}
      {activeTab === 'send' && (
        <div className="space-y-6">
          {/* Quick Send Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Bill Notifications</h3>
              </div>
              <p className="text-sm text-green-800 mb-4">
                Send bill reminder to all {customers.length} active customers
              </p>
              <button
                onClick={async () => {
                  setSendToAll(true);
                  setNotificationType('bill');
                  setShowPreview(true);
                }}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send to All Customers
              </button>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Contribution Notifications</h3>
              </div>
              <p className="text-sm text-blue-800 mb-4">
                Send contribution reminder to all {customers.length} active customers
              </p>
              <button
                onClick={async () => {
                  setSendToAll(true);
                  setNotificationType('contribution');
                  setShowPreview(true);
                }}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send to All Customers
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="text-sm text-gray-600 font-medium">OR SEND TO SPECIFIC CUSTOMERS</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Manual Selection Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer Selection Panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Recipients</h2>

              {/* Send to All Toggle */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToAll}
                    onChange={(e) => setSendToAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Send to All Active Customers</span>
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  {customers.length} active customers available
                </p>
              </div>

            {!sendToAll && (
              <>
                {/* Search and Filters */}
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name, account, phone..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <select
                    value={filterZone}
                    onChange={(e) => handleZoneFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Zones</option>
                    {getUniqZones().map(zone => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select All */}
                <label className="flex items-center gap-2 cursor-pointer mb-3 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({filteredCustomers.length})
                  </span>
                </label>

                {/* Customer List */}
                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto space-y-1">
                  {filteredCustomers.length > 0 ? (
                    <>
                      {filteredCustomers.map(customer => (
                        <label
                          key={customer.id}
                          className="flex items-start gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(customer.id)}
                            onChange={() => handleSelectCustomer(customer.id)}
                            className="rounded border-gray-300 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">{customer.full_name}</p>
                            <p className="text-xs text-gray-600">
                              {customer.account_number} • {customer.phone}
                            </p>
                            {customer.zone && (
                              <p className="text-xs text-blue-600">{customer.zone}</p>
                            )}
                          </div>
                        </label>
                      ))}
                      {currentPage < totalPages && (
                        <button
                          onClick={loadMoreCustomers}
                          disabled={loading}
                          className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors disabled:opacity-50"
                        >
                          {loading ? 'Loading...' : 'Load More Customers'}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">No customers found</div>
                  )}
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  {selectedCustomers.size} selected
                </p>
              </>
            )}
            </div>

          {/* Notification Display Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Message to Send</h2>

            <div className="space-y-4">
              {/* Notification Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Type
                </label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value as 'bill' | 'contribution' | 'fine' | 'overdue')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bill">Bill Notification</option>
                  <option value="contribution">Contribution Reminder</option>
                  <option value="fine">Fine Notification</option>
                  <option value="overdue">Overdue Payment Reminder</option>
                </select>
              </div>

              {/* Auto-Generated Message Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auto-Generated Message</label>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">
                    {getAutoGeneratedMessage()}
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  This message will be personalized for each recipient using their name and account number.
                </p>
              </div>

              {/* Message Preview */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-900 mb-1">SMS Preview (max 160 chars):</p>
                <p className="text-sm text-blue-800 font-mono">
                  {generatePreviewMessage() || '(No message)'}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Actual length: {generatePreviewMessage().length}/160 characters
                </p>
              </div>

              {/* Template Variables Info */}
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs font-medium text-yellow-900 mb-2">📋 Template Variables Used:</p>
                <ul className="text-xs text-yellow-800 space-y-1">
                  <li>• {'{customer_name}'} - Customer's full name</li>
                  <li>• {'{account_number}'} - Customer's account number</li>
                  <li>• {'{phone}'} - Customer's phone number</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={loading || (!sendToAll && selectedCustomers.size === 0)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Preview
                </button>
                <button
                  onClick={handleSendNotifications}
                  disabled={loading || (!sendToAll && selectedCustomers.size === 0)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Sending...' : 'Send Notifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification History</h2>
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>Notification history is coming soon</p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Notification</h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Recipients:</span>{' '}
                {sendToAll ? 'All Active Customers' : `${selectedCustomers.size} selected customer(s)`}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span> {notificationType === 'bill' ? 'Bill Notification' : 'Contribution Reminder'}
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
              <p className="text-xs text-blue-600 font-medium mb-2">Message Preview:</p>
              <p className="text-sm text-gray-900 font-mono">{generatePreviewMessage()}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotifications}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && sendResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              {sendResults.failed === 0 ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">Notifications Sent</h3>
              <button
                onClick={() => setShowResults(false)}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{sendResults.total}</p>
                <p className="text-xs text-gray-600">Total Recipients</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{sendResults.successful}</p>
                <p className="text-xs text-gray-600">Successful</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{sendResults.failed}</p>
                <p className="text-xs text-gray-600">Failed</p>
              </div>
            </div>

            {sendResults.failed_details && sendResults.failed_details.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-900 mb-2">Failed Notifications:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sendResults.failed_details.map((detail, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs font-medium text-red-900">{detail.customer_name}</p>
                      <p className="text-xs text-red-700">{detail.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowResults(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagement;