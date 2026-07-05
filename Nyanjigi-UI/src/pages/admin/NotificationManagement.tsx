/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Send,
  Bell,
  X,
  CheckCircle,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import SearchBar from '../../components/common/SearchBar';

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

interface NotificationMetadata {
  customer_name?: string;
  account_number?: string;
  amount?: string;
  due_date?: string;
  bill_number?: string;
  transaction_id?: string;
  message?: string;
}

interface NotificationPayload {
  sms?: {
    success: boolean;
    cost?: string;
    error?: string;
    status?: string;
    message_id?: string;
  };
}

interface NotificationHistoryRecord {
  id: number;
  recipient: string;
  notification_type: string;
  message: string;
  status: 'sent' | 'failed' | string;
  sent_at: string;
  metadata: NotificationMetadata;
  payload: NotificationPayload;
}

type NotificationType = 'bill' | 'contribution' | 'fine' | 'overdue' | 'custom';

const AUTO_GENERATED_MESSAGES: Record<NotificationType, string> = {
  bill: 'Dear {customer_name}, your total outstanding water bill for account {account_number} is {total_bill}. Please pay at your earliest convenience. Thank you.',
  
  contribution: 'Dear {customer_name}, your remaining contribution balance for account {account_number} is {contribution_balance}. Please remit payment. Thank you.',
  
  fine: 'Dear {customer_name}, you have unpaid fines totaling {total_fines} on your account {account_number}. Please settle this immediately. Thank you.',
  
  overdue: 'Dear {customer_name}, account {account_number} is overdue. Bill: {total_bill}, Contribution: {contribution_balance}, Fines: {total_fines}. Please pay without delay.',

  custom: 'Dear {customer_name}, this is a custom announcement from the water utility. Please review the attached message carefully.'
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
  const [notificationType, setNotificationType] = useState<NotificationType>('bill');
  const [sendToAll, setSendToAll] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  
  // Manual Balance States
  const [manualBill, setManualBill] = useState('');
  const [manualContribution, setManualContribution] = useState('');
  const [manualFines, setManualFines] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // UI State
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sendResults, setSendResults] = useState<NotificationResult | null>(null);

// History State
  const [history, setHistory] = useState<NotificationHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  
  // Interactive View State
  const [selectedNotification, setSelectedNotification] = useState<NotificationHistoryRecord | null>(null);

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

const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const params: any = { page: historyPage, limit: 15 };
      if (historyTypeFilter) params.notification_type = historyTypeFilter;
      
      const response = await adminService.getNotificationHistory(params);
      const { notifications, pagination } = response.data?.data || {};
      
      setHistory(notifications || []);
      if (pagination) {
        setHistoryTotalPages(pagination.total_pages || 1);
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to fetch history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyPage, historyTypeFilter]);

  // Fetch history when tab becomes active or dependencies change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyPage, historyTypeFilter]);

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

  const getProcessedMessage = () => {
    if (notificationType === 'custom') {
      return customMessage.trim() || 'Enter a custom message to send to your customers.';
    }

    return getAutoGeneratedMessage()
      .replace(/\{total_bill\}/g, manualBill ? `KES ${manualBill}` : '[Total Bill]')
      .replace(/\{contribution_balance\}/g, manualContribution ? `KES ${manualContribution}` : '[Contribution]')
      .replace(/\{total_fines\}/g, manualFines ? `KES ${manualFines}` : '[Fines]');
  };

  const generatePreviewMessage = () => {
    // UPDATED: Now uses getProcessedMessage() instead of getAutoGeneratedMessage()
    let preview = getProcessedMessage()
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
        message: getProcessedMessage(), // <-- Updated line
        send_to_all: sendToAll,
        ...(!sendToAll && { customer_ids: Array.from(selectedCustomers) })
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
                  <div>
                    <SearchBar value={searchTerm} onChange={(e) => handleSearch(e.target.value)} placeholder="Search name, account, phone..." className="text-sm" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Type
                </label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value as NotificationType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bill">Bill Notification</option>
                  <option value="contribution">Contribution Reminder</option>
                  <option value="fine">Fine Notification</option>
                  <option value="overdue">Overdue Payment Reminder</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              {notificationType === 'custom' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Message</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Example: There will be a meeting on Friday at 10:00 AM. Please attend."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Use this option for announcements such as meetings, rate changes, service updates, or other important notices.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">Manual Financial Inputs</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Total Bill (KES)</label>
                      <input
                        type="number"
                        value={manualBill}
                        onChange={(e) => setManualBill(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contribution (KES)</label>
                      <input
                        type="number"
                        value={manualContribution}
                        onChange={(e) => setManualContribution(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Total Fines (KES)</label>
                      <input
                        type="number"
                        value={manualFines}
                        onChange={(e) => setManualFines(e.target.value)}
                        placeholder="e.g. 200"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-red-600">
                    * Note: The amounts entered above will be sent exactly as typed to ALL selected customers.
                  </p>
                </div>
              )}

              {/* Auto-Generated Message Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{notificationType === 'custom' ? 'Custom Message Preview' : 'Auto-Generated Message'}</label>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">
                    {getProcessedMessage()}
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {notificationType === 'custom'
                    ? 'This message will be sent exactly as written to each selected recipient.'
                    : 'This message will be personalized for each recipient using their name, account number, and customer financial balances.'}
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
                <p className="text-xs font-medium text-yellow-900 mb-2">Template Variables Used:</p>
                <ul className="text-xs text-yellow-800 space-y-1">
                  <li>• {'{customer_name}'} - Customer's full name</li>
                  <li>• {'{account_number}'} - Customer's account number</li>
                  <li>• {'{phone}'} - Customer's phone number</li>
                  <li>• {'{total_bill}'} - Total outstanding water bill</li>
                  <li>• {'{contribution_balance}'} - Remaining contribution balance</li> 
                  <li>• {'{total_fines}'} - Total unpaid fines</li>                   
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Notification Logs</h2>
              <p className="text-xs text-gray-500 mt-1">View the status of all sent messages</p>
            </div>
            
            {/* History Filter */}
            <div className="relative">
              <select
                value={historyTypeFilter}
                onChange={(e) => {
                  setHistoryTypeFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white text-gray-600 font-medium transition-shadow cursor-pointer hover:bg-gray-50"
              >
                <option value="">All Types</option>
                <option value="manual_sms">Manual SMS</option>
                <option value="overdue_notice">Overdue Notice</option>
                <option value="payment_received">Payment Received</option>
                <option value="custom">Custom Message</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 font-medium animate-pulse">Loading records...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">No notification history found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium">Recipient</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-50">
                  {history.map((record) => (
                    <tr 
                      key={record.id} 
                      onClick={() => setSelectedNotification(record)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-800 font-medium">
                          {new Date(record.sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(record.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-800 font-medium truncate max-w-[150px]">
                          {record.metadata?.customer_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          {record.recipient}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize bg-gray-100 text-gray-600">
                          {record.notification_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.status === 'sent' ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md w-max">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold">Sent</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md w-max">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold">Failed</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* History Pagination */}
              {historyTotalPages > 1 && (
                <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/30">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-white hover:shadow-sm transition-all bg-transparent"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-500">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage === historyTotalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-white hover:shadow-sm transition-all bg-transparent"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Interactive Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform scale-100 transition-transform duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedNotification.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {selectedNotification.status === 'sent' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Message Details</h3>
                  <p className="text-xs text-gray-500">{new Date(selectedNotification.sent_at).toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNotification(null)}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Recipient Info Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Recipient</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedNotification.metadata?.customer_name || 'N/A'}</p>
                  <p className="text-sm text-gray-600 font-mono mt-0.5">{selectedNotification.recipient}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Account</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedNotification.metadata?.account_number || 'N/A'}</p>
                  <p className="text-sm text-gray-600 capitalize mt-0.5">{selectedNotification.notification_type.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  Message Content
                </p>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-gray-700 font-mono leading-relaxed">
                  {selectedNotification.message}
                </div>
              </div>

              {/* Error Details (If Failed) */}
              {selectedNotification.status === 'failed' && selectedNotification.payload?.sms?.error && (
                <div>
                   <p className="text-sm font-semibold text-rose-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Delivery Failure Reason
                  </p>
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-sm text-rose-700">
                    {selectedNotification.payload.sms.error}
                  </div>
                </div>
              )}

              {/* Delivery Cost (If Sent) */}
              {selectedNotification.status === 'sent' && selectedNotification.payload?.sms?.cost && (
                <div className="flex justify-between items-center py-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Provider Cost</span>
                  <span className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded">{selectedNotification.payload.sms.cost}</span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={() => setSelectedNotification(null)}
                className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm text-sm"
              >
                Close Details
              </button>
            </div>
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