/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  Users,
  FileText,
  CheckCircle,
  Send,
  RefreshCw,
  Bell,
  Package,
  X
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const NotificationManagement: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('status');

  // SMS Status State
  const [smsStatus, setSmsStatus] = useState<any>(null);

  // Single SMS State
  const [singleSms, setSingleSms] = useState({ phone_number: '', message: '', sender_id: '' });

  // Bulk SMS State
  const [bulkSms, setBulkSms] = useState({ recipients: '' as string, message: '', sender_id: '' });
  const [bulkRecipients, setBulkRecipients] = useState<string[]>([]);

  // Bill Reminders State
  const [billReminders, setBillReminders] = useState({ days_overdue: 1, customer_ids: [] as number[] });
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);

  // Payment Confirmations State
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);

  // Custom Notifications State
  const [customNotifications, setCustomNotifications] = useState({
    customer_ids: [] as number[],
    message: '',
    notification_type: 'sms' as 'sms' | 'email' | 'both'
  });
  const [selectedCustomCustomers, setSelectedCustomCustomers] = useState<number[]>([]);

  // Delivery Status State
  const [deliveryMessageId, setDeliveryMessageId] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<any>(null);

  // Fetch SMS Status on mount
  useEffect(() => {
    fetchSmsStatus();
  }, []);

  const fetchSmsStatus = async () => {
    try {
      setLoading(true);
      const response = await adminService.getSmsStatus();
      setSmsStatus(response.data.data || response.data);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to fetch SMS status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSingleSms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await adminService.sendSms(singleSms);
      addToast('SMS sent successfully', 'success');
      setSingleSms({ phone_number: '', message: '', sender_id: '' });
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send SMS', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkRecipients.length === 0) {
      addToast('Please add at least one recipient', 'error');
      return;
    }
    try {
      setLoading(true);
      const data = {
        recipients: bulkRecipients,
        message: bulkSms.message,
        sender_id: bulkSms.sender_id || undefined
      };
      const response = await adminService.sendBulkSms(data);
      addToast(`Bulk SMS sent: ${response.data.successful_notifications || 0} successful`, 'success');
      setBulkSms({ recipients: '', message: '', sender_id: '' });
      setBulkRecipients([]);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send bulk SMS', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addBulkRecipient = () => {
    if (bulkSms.recipients.trim()) {
      const numbers = bulkSms.recipients.split(',').map(n => n.trim()).filter(n => n);
      setBulkRecipients(prev => [...prev, ...numbers]);
      setBulkSms(prev => ({ ...prev, recipients: '' }));
    }
  };

  const removeBulkRecipient = (index: number) => {
    setBulkRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendBillReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = {
        days_overdue: parseInt(billReminders.days_overdue.toString()),
        ...(selectedCustomers.length > 0 && { customer_ids: selectedCustomers })
      };
      const response = await adminService.sendBillReminders(data);
      addToast(`Bill reminders sent: ${response.data.successful_notifications || 0} successful`, 'success');
      setBillReminders({ days_overdue: 1, customer_ids: [] });
      setSelectedCustomers([]);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send bill reminders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPaymentConfirmations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPayments.length === 0) {
      addToast('Please select at least one payment', 'error');
      return;
    }
    try {
      setLoading(true);
      const data = { payment_ids: selectedPayments };
      const response = await adminService.sendPaymentConfirmations(data);
      addToast(`Payment confirmations sent: ${response.data.successful_notifications || 0} successful`, 'success');
      setSelectedPayments([]);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send payment confirmations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCustomNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomCustomers.length === 0) {
      addToast('Please select at least one customer', 'error');
      return;
    }
    try {
      setLoading(true);
      const data = {
        customer_ids: selectedCustomCustomers,
        message: customNotifications.message,
        notification_type: customNotifications.notification_type
      };
      const response = await adminService.sendCustomNotifications(data);
      addToast(`Custom notifications sent: ${response.data.successful_notifications || 0} successful`, 'success');
      setCustomNotifications({ customer_ids: [], message: '', notification_type: 'sms' });
      setSelectedCustomCustomers([]);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send custom notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckDeliveryStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryMessageId.trim()) {
      addToast('Please enter a message ID', 'error');
      return;
    }
    try {
      setLoading(true);
      const response = await adminService.getSmsDeliveryStatus(deliveryMessageId);
      setDeliveryStatus(response.data.data || response.data);
      addToast('Delivery status checked', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to check delivery status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'status', label: 'SMS Status', icon: Phone },
    { id: 'single', label: 'Single SMS', icon: MessageSquare },
    { id: 'bulk', label: 'Bulk SMS', icon: Users },
    { id: 'reminders', label: 'Bill Reminders', icon: FileText },
    { id: 'payments', label: 'Payment Confirmations', icon: Package },
    { id: 'custom', label: 'Custom Notifications', icon: Bell },
    { id: 'delivery', label: 'Delivery Status', icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Notifications Management</h1>
          <p className="text-blue-700">Manage SMS and notification services for customers</p>
        </div>

        <button
          onClick={fetchSmsStatus}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-1 border border-white/30">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-blue-700 hover:bg-white/30'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* SMS Status Tab */}
        {activeTab === 'status' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <Phone className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">SMS Service Status</h3>
                <p className="text-blue-700">Current SMS service connection and account balance</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                <span>Loading status...</span>
              </div>
            ) : smsStatus ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-700">Service Status</label>
                  <div className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    smsStatus.service_status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {smsStatus.service_status ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-700">Account Balance</label>
                  <div className="text-2xl font-bold text-blue-900">
                    KES {smsStatus.account_balance?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-700">Last Checked</label>
                  <div className="text-sm text-blue-600">
                    {new Date(smsStatus.last_checked).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-blue-600">
                No status available. Click refresh to check.
              </div>
            )}
          </div>
        )}

        {/* Single SMS Tab */}
        {activeTab === 'single' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Send Single SMS</h3>
                <p className="text-blue-700">Send an SMS message to a single phone number</p>
              </div>
            </div>

            <form onSubmit={handleSendSingleSms} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+2547XXXXXXXX or 07XXXXXXXX"
                  value={singleSms.phone_number}
                  onChange={(e) => setSingleSms(prev => ({ ...prev, phone_number: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Message (max 160 chars)</label>
                <textarea
                  placeholder="Enter your message here..."
                  value={singleSms.message}
                  onChange={(e) => setSingleSms(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={160}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">
                  {singleSms.message.length}/160 characters
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Sender ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., NYANJIGI"
                  value={singleSms.sender_id}
                  onChange={(e) => setSingleSms(prev => ({ ...prev, sender_id: e.target.value }))}
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : 'Send SMS'}
              </button>
            </form>
          </div>
        )}

        {/* Bulk SMS Tab */}
        {activeTab === 'bulk' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Send Bulk SMS</h3>
                <p className="text-blue-700">Send SMS messages to multiple recipients (max 1000)</p>
              </div>
            </div>

            <form onSubmit={handleSendBulkSms} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Add Recipients (comma-separated)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., +254712345678, 07123456789"
                    value={bulkSms.recipients}
                    onChange={(e) => setBulkSms(prev => ({ ...prev, recipients: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addBulkRecipient}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Current Recipients ({bulkRecipients.length}/1000)</label>
                <div className="flex flex-wrap gap-2">
                  {bulkRecipients.map((recipient, index) => (
                    <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                      {recipient}
                      <button
                        type="button"
                        onClick={() => removeBulkRecipient(index)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Remove recipient"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Message (max 160 chars)</label>
                <textarea
                  placeholder="Enter your bulk message here..."
                  value={bulkSms.message}
                  onChange={(e) => setBulkSms(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={160}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">
                  {bulkSms.message.length}/160 characters
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Sender ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., NYANJIGI"
                  value={bulkSms.sender_id}
                  onChange={(e) => setBulkSms(prev => ({ ...prev, sender_id: e.target.value }))}
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading || bulkRecipients.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : `Send to ${bulkRecipients.length} Recipients`}
              </button>
            </form>
          </div>
        )}

        {/* Bill Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Bill Reminders</h3>
                <p className="text-blue-700">Send automated bill reminder notifications to overdue customers</p>
              </div>
            </div>

            <form onSubmit={handleSendBillReminders} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Days Overdue</label>
                <select
                  value={billReminders.days_overdue}
                  onChange={(e) => setBillReminders(prev => ({ ...prev, days_overdue: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 7, 14, 30, 60, 90].map(day => (
                    <option key={day} value={day}>{day} days</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Filter by Customers (optional)</label>
                <input
                  type="text"
                  placeholder="Enter customer IDs (comma-separated)"
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    setSelectedCustomers(ids);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">Selected: {selectedCustomers.length} customers</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : 'Send Bill Reminders'}
              </button>
            </form>
          </div>
        )}

        {/* Payment Confirmations Tab */}
        {activeTab === 'payments' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Payment Confirmations</h3>
                <p className="text-blue-700">Send payment confirmation notifications to customers</p>
              </div>
            </div>

            <form onSubmit={handleSendPaymentConfirmations} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Payment IDs</label>
                <input
                  type="text"
                  placeholder="Enter payment IDs (comma-separated)"
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    setSelectedPayments(ids);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">Selected: {selectedPayments.length} payments</p>
              </div>
              <button
                type="submit"
                disabled={loading || selectedPayments.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : `Send Confirmations to ${selectedPayments.length} Payments`}
              </button>
            </form>
          </div>
        )}

        {/* Custom Notifications Tab */}
        {activeTab === 'custom' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Custom Notifications</h3>
                <p className="text-blue-700">Send custom messages to specific customers via SMS, Email, or both</p>
              </div>
            </div>

            <form onSubmit={handleSendCustomNotifications} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Customer IDs</label>
                <input
                  type="text"
                  placeholder="Enter customer IDs (comma-separated)"
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    setSelectedCustomCustomers(ids);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">Selected: {selectedCustomCustomers.length} customers</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Message (max 160 chars)</label>
                <textarea
                  placeholder="Enter custom message..."
                  value={customNotifications.message}
                  onChange={(e) => setCustomNotifications(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={160}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600">
                  {customNotifications.message.length}/160 characters
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Notification Type</label>
                <select
                  value={customNotifications.notification_type}
                  onChange={(e) => setCustomNotifications(prev => ({ ...prev, notification_type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sms">SMS Only</option>
                  <option value="email">Email Only</option>
                  <option value="both">SMS + Email</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || selectedCustomCustomers.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : `Send to ${selectedCustomCustomers.length} Customers`}
              </button>
            </form>
          </div>
        )}

        {/* Delivery Status Tab */}
        {activeTab === 'delivery' && (
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl p-6 border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-blue-900">SMS Delivery Status</h3>
                <p className="text-blue-700">Check the delivery status of a specific SMS message</p>
              </div>
            </div>

            <form onSubmit={handleCheckDeliveryStatus} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-700">Message ID</label>
                <input
                  type="text"
                  placeholder="Enter message ID"
                  value={deliveryMessageId}
                  onChange={(e) => setDeliveryMessageId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </form>

            {deliveryStatus && (
              <div className="mt-6 space-y-4">
                <h4 className="text-lg font-semibold text-blue-900">Status Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-700">Delivery Status</label>
                    <div className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                      deliveryStatus.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      deliveryStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {deliveryStatus.status?.toUpperCase() || 'Unknown'}
                    </div>
                  </div>
                  {deliveryStatus.timestamp && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-blue-700">Delivered At</label>
                      <p className="text-sm text-blue-600">
                        {new Date(deliveryStatus.timestamp).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {deliveryStatus.error && (
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium text-blue-700">Error Details</label>
                      <p className="text-sm text-red-600">{deliveryStatus.error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManagement;
