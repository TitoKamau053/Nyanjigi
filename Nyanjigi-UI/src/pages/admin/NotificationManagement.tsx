/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  AlertCircle,
  Send,
  RefreshCw,
  Bell
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
  const [singleSms, setSingleSms] = useState({ phone_number: '', message: '' });

  // Bill Reminders State
  const [billReminders, setBillReminders] = useState({ days_overdue: 1 });

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
      setSingleSms({ phone_number: '', message: '' });
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send SMS', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendBillReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = {
        days_overdue: parseInt(billReminders.days_overdue.toString())
      };
      const response = await adminService.sendBillReminders(data);
      addToast(`Bill reminders sent: ${response.data.successful_notifications || 0} successful`, 'success');
      setBillReminders({ days_overdue: 1 });
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to send bill reminders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'status', label: 'Service Status', icon: Phone },
    { id: 'single', label: 'Send SMS', icon: MessageSquare },
    { id: 'reminders', label: 'Bill Reminders', icon: AlertCircle },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
          <div className="flex items-center gap-2 mt-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-gray-600">SMS Gateway: <span className="font-semibold text-blue-600">Africa's Talking</span></p>
          </div>
        </div>

        <button
          onClick={fetchSmsStatus}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* SMS Status Tab */}
        {activeTab === 'status' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Service Status</h2>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                <span>Loading status...</span>
              </div>
            ) : smsStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <div className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    smsStatus.service_status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {smsStatus.service_status ? '✓ Active' : '✗ Inactive'}
                  </div>
                </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Account Balance</p>
                <p className="text-lg font-bold text-gray-900">
                  KES {(() => {
                    const balance = smsStatus.account_balance;
                    if (balance && typeof balance === 'object' && balance.value) {
                      return parseFloat(balance.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else if (typeof balance === 'number') {
                      return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else if (typeof balance === 'string') {
                      return parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    return '0.00';
                  })()}
                </p>
              </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Gateway</p>
                  <p className="text-sm font-semibold text-blue-600">Africa's Talking</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No status available. Click refresh to check.
              </div>
            )}
          </div>
        )}

        {/* Single SMS Tab */}
        {activeTab === 'single' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Send SMS</h2>

            <form onSubmit={handleSendSingleSms} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+254712345678"
                  value={singleSms.phone_number}
                  onChange={(e) => setSingleSms(prev => ({ ...prev, phone_number: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  placeholder="Enter message (max 160 characters)..."
                  value={singleSms.message}
                  onChange={(e) => setSingleSms(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={160}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {singleSms.message.length}/160
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 font-medium"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : 'Send SMS'}
              </button>
            </form>
          </div>
        )}

        {/* Bill Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Send Bill Reminders</h2>

            <form onSubmit={handleSendBillReminders} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Send reminders to customers with bills overdue by:</label>
                <select
                  value={billReminders.days_overdue}
                  onChange={(e) => setBillReminders(prev => ({ ...prev, days_overdue: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 7, 14, 30, 60, 90].map(day => (
                    <option key={day} value={day}>{day} days or more</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 font-medium"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Sending...' : 'Send Reminders'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManagement;
