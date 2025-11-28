/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Calendar, Bell, Database, Shield, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';

interface SystemSetting {
  id: number;
  category: string;
  setting_key: string;
  setting_value: string;
  description: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('billing');
  const { addToast } = useToast();

  // Fetch settings from backend
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getSettings();

      console.log('Settings API Response:', response); // Debug log

      // Check if response exists
      if (!response) {
        throw new Error('No response received from server');
      }

      // Check if response.data exists
      if (!response.data) {
        throw new Error('No data in response from server');
      }

      let settingsArray: any[] = [];

      // Handle different response formats - prioritize the 'all' array from backend
      if (response.data.data && response.data.data.all && Array.isArray(response.data.data.all)) {
        console.log('Found settings in response.data.data.all:', response.data.data.all);
        settingsArray = response.data.data.all;
      } else if (Array.isArray(response.data)) {
        settingsArray = response.data;
      } else if (response.data.settings && Array.isArray(response.data.settings)) {
        settingsArray = response.data.settings;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        settingsArray = response.data.data;
      } else if (typeof response.data === 'object' && response.data !== null) {
        // If it's a single object, wrap it in an array
        settingsArray = [response.data];
      } else {
        throw new Error('Invalid response format from server');
      }

      // Check if we have any settings
      if (settingsArray.length === 0) {
        throw new Error('No settings found in response');
      }

      // If we have categorized data, use it to enhance the settings with descriptions
      if (response.data.data && response.data.data.categorized) {
        const categorizedData = response.data.data.categorized;
        settingsArray = settingsArray.map((setting: any) => {
          // Find the description from categorized data
          const categoryData = categorizedData[setting.category];
          if (categoryData && categoryData[setting.setting_key]) {
            return {
              ...setting,
              description: categoryData[setting.setting_key].description || setting.description
            };
          }
          return setting;
        });
      }

      // Transform API response to match component interface
      const transformedSettings: SystemSetting[] = settingsArray.map((setting: any, index: number) => ({
        id: setting.id || index + 1,
        category: setting.category || 'general',
        setting_key: setting.setting_key || setting.key || '',
        setting_value: String(setting.setting_value || setting.value || ''),
        description: setting.description || setting.name || '',
        data_type: setting.data_type || 'string'
      }));

      console.log('Transformed settings:', transformedSettings);
      setSettings(transformedSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to load settings from server: ${errorMessage}`);
      addToast('Failed to load settings', 'error');

      // Fallback to default settings that match the backend structure
      setSettings([
        {
          id: 1,
          category: 'billing',
          setting_key: 'default_billing_day',
          setting_value: '1',
          description: 'Day of month to generate bills',
          data_type: 'number'
        },
        {
          id: 2,
          category: 'billing',
          setting_key: 'expected_contribution_amount',
          setting_value: '18500',
          description: 'Expected contribution amount from customers',
          data_type: 'number'
        },
        {
          id: 3,
          category: 'billing',
          setting_key: 'late_fine_grace_days',
          setting_value: '7',
          description: 'Grace period before applying late fines',
          data_type: 'number'
        },
        {
          id: 4,
          category: 'billing',
          setting_key: 'payment_due_days',
          setting_value: '30',
          description: 'Days after bill generation for due date',
          data_type: 'number'
        },
        {
          id: 5,
          category: 'contributions',
          setting_key: 'contribution_due_days',
          setting_value: '30',
          description: 'Days after month start for contribution due date',
          data_type: 'number'
        },
        {
          id: 6,
          category: 'contributions',
          setting_key: 'monthly_contribution_amount',
          setting_value: '100.00',
          description: 'Monthly contribution amount for all customers',
          data_type: 'number'
        },
        {
          id: 7,
          category: 'general',
          setting_key: 'company_email',
          setting_value: 'info@nyanjigi.co.ke',
          description: 'Company contact email',
          data_type: 'string'
        },
        {
          id: 8,
          category: 'general',
          setting_key: 'company_name',
          setting_value: 'Nyanjigi Waters Management System',
          description: 'Company name for billing',
          data_type: 'string'
        },
        {
          id: 9,
          category: 'general',
          setting_key: 'company_phone',
          setting_value: '+254700000000',
          description: 'Company contact phone',
          data_type: 'string'
        },
        {
          id: 10,
          category: 'notifications',
          setting_key: 'sms_sender_id',
          setting_value: 'NYANJIGI',
          description: 'SMS sender ID',
          data_type: 'string'
        },
        {
          id: 11,
          category: 'payments',
          setting_key: 'jenga_api_url',
          setting_value: 'https://uat.jengahq.io',
          description: 'Jenga API base URL',
          data_type: 'string'
        },
        {
          id: 12,
          category: 'payments',
          setting_key: 'jenga_consumer_key',
          setting_value: '',
          description: 'Jenga API consumer key',
          data_type: 'string'
        },
        {
          id: 13,
          category: 'payments',
          setting_key: 'jenga_consumer_secret',
          setting_value: '',
          description: 'Jenga API consumer secret',
          data_type: 'string'
        },
        {
          id: 14,
          category: 'payments',
          setting_key: 'stk_callback_url',
          setting_value: '',
          description: 'STK Push callback URL',
          data_type: 'string'
        },
        {
          id: 15,
          category: 'payments',
          setting_key: 'stk_push_shortcode',
          setting_value: '',
          description: 'STK Push shortcode',
          data_type: 'string'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (settingKey: string, value: string) => {
    const updatedSettings = settings.map(setting =>
      setting.setting_key === settingKey ? { ...setting, setting_value: value } : setting
    );
    setSettings(updatedSettings);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      // Transform settings to API format
      const settingsToUpdate = settings.map(setting => ({
        setting_key: setting.setting_key,
        setting_value: setting.setting_value,
        category: setting.category,
        data_type: setting.data_type
      }));

      await adminService.bulkUpdateSettings(settingsToUpdate);
      addToast('Settings updated successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      addToast('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getSettingsByCategory = (category: string) => {
    return settings.filter(setting => setting.category === category);
  };

  // Helper function to get user-friendly labels for setting keys
  const getSettingLabel = (settingKey: string) => {
    const labels: { [key: string]: string } = {
      'default_billing_day': 'Default Billing Day',
      'expected_contribution_amount': 'Expected Contribution Amount',
      'late_fine_grace_days': 'Late Fine Grace Days',
      'payment_due_days': 'Payment Due Days',
      'contribution_due_days': 'Contribution Due Days',
      'monthly_contribution_amount': 'Monthly Contribution Amount',
      'company_email': 'Company Email',
      'company_name': 'Company Name',
      'company_phone': 'Company Phone',
      'sms_sender_id': 'SMS Sender ID',
      'jenga_api_url': 'Jenga API URL',
      'jenga_consumer_key': 'Jenga Consumer Key',
      'jenga_consumer_secret': 'Jenga Consumer Secret',
      'stk_callback_url': 'STK Callback URL',
      'stk_push_shortcode': 'STK Push Shortcode'
    };
    return labels[settingKey] || settingKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const handleChange = (value: string) => {
      updateSetting(setting.setting_key, value);
    };

    switch (setting.data_type) {
      case 'boolean':
        return (
          <select
            value={setting.setting_value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={setting.setting_value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      default:
        return (
          <input
            type="text"
            value={setting.setting_value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  const tabs = [
    { id: 'billing', name: 'Billing', icon: DollarSign },
    { id: 'contributions', name: 'Contributions', icon: Calendar },
    { id: 'general', name: 'General', icon: Database },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'payments', name: 'Payments', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure system parameters and preferences</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="border-b border-white/30">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="p-6">
          <div className="space-y-6">
            {getSettingsByCategory(activeTab).map((setting) => (
              <div key={setting.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {getSettingLabel(setting.setting_key)}
                  </label>
                  <p className="text-sm text-gray-600">{setting.description}</p>
                </div>
                <div>
                  {renderSettingInput(setting)}
                </div>
              </div>
            ))}
          </div>

          {getSettingsByCategory(activeTab).length === 0 && (
            <div className="text-center py-12">
              <Settings className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No settings found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Settings for this category will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Database</h3>
          </div>
          <p className="text-gray-600 mb-4">Manage database operations and maintenance.</p>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            Run Maintenance
          </button>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Security</h3>
          </div>
          <p className="text-gray-600 mb-4">Review security logs and access controls.</p>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
            View Logs
          </button>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-8 h-8 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
          <p className="text-gray-600 mb-4">Test notification systems and alerts.</p>
          <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors">
            Send Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
