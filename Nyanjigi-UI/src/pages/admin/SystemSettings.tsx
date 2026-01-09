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

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getSettings();

      let settingsArray: any[] = [];

      // Handle response formats
      if (response.data.data && response.data.data.all) {
        settingsArray = response.data.data.all;
      } else if (Array.isArray(response.data?.data)) {
        settingsArray = response.data.data;
      } else if (Array.isArray(response.data)) {
        settingsArray = response.data;
      }

      // Auto-initialize if empty
      if (!settingsArray || settingsArray.length === 0) {
        console.log('No settings found, initializing defaults...');
        await adminService.initializeSettings();
        // Retry fetch once
        const retry = await adminService.getSettings();
        settingsArray = retry.data.data?.all || retry.data.data || [];
      }

      // Transform
      const transformedSettings: SystemSetting[] = settingsArray.map((setting: any, index: number) => ({
        id: setting.id || index + 1,
        category: setting.category || 'general',
        setting_key: setting.setting_key || setting.key || '',
        setting_value: String(setting.setting_value || setting.value || ''),
        description: setting.description || setting.name || '',
        data_type: setting.data_type || 'string'
      }));

      setSettings(transformedSettings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      setError(error.message || 'Failed to load settings');
      addToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = (settingKey: string, value: string) => {
    setSettings(prev => prev.map(s => s.setting_key === settingKey ? { ...s, setting_value: value } : s));
  };

const saveSettings = async () => {
    try {
      setSaving(true);
      
      // FIX: Transform array to key-value object wrapped in 'settings'
      const settingsMap = settings.reduce((acc: any, curr) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});

      // Send object matching backend expectation: { settings: { key: value } }
      await adminService.bulkUpdateSettings({ settings: settingsMap });
      
      addToast('Settings updated successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      addToast('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Button Handlers
  const handleRunMaintenance = async () => {
    try {
      addToast('Starting system maintenance...', 'info');
      await adminService.runSystemMaintenance();
      addToast('Maintenance completed successfully', 'success');
    } catch (error) {
      addToast('Maintenance failed', 'error');
    }
  };

  const handleViewLogs = async () => {
    try {
      const res = await adminService.getSecurityLogs();
      console.log('Security Logs:', res.data);
      addToast('Security logs fetched (check console)', 'success');
    } catch (error) {
      addToast('Failed to fetch logs', 'error');
    }
  };

  const handleTestNotification = async () => {
    try {
      await adminService.sendTestNotification();
      addToast('Test SMS sent to admin', 'success');
    } catch (error) {
      addToast('Failed to send test SMS', 'error');
    }
  };

  const getSettingsByCategory = (category: string) => settings.filter(s => s.category === category);
  const getSettingLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const renderSettingInput = (setting: SystemSetting) => {
    if (setting.data_type === 'boolean') {
      return (
        <select
          value={setting.setting_value}
          onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    return (
      <input
        type={setting.data_type === 'number' ? 'number' : 'text'}
        value={setting.setting_value}
        onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  const tabs = [
    { id: 'billing', name: 'Billing', icon: DollarSign },
    { id: 'contributions', name: 'Contributions', icon: Calendar },
    { id: 'general', name: 'General', icon: Database },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'payments', name: 'Payments', icon: Shield },
  ];

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure system parameters and preferences</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="bg-red-50 p-4 rounded text-red-800">{error}</div>}

      <div className="bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
        <div className="border-b border-white/30 px-6 flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.name}
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-6">
          {getSettingsByCategory(activeTab).map((setting) => (
            <div key={setting.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  {getSettingLabel(setting.setting_key)}
                </label>
                <p className="text-sm text-gray-600">{setting.description}</p>
              </div>
              <div>{renderSettingInput(setting)}</div>
            </div>
          ))}
          {getSettingsByCategory(activeTab).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Settings className="mx-auto h-12 w-12 text-gray-400" />
              <p>No settings found for this category.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions - CONNECTED TO ENDPOINTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Database</h3>
          </div>
          <p className="text-gray-600 mb-4">Run manual system maintenance tasks.</p>
          <button onClick={handleRunMaintenance} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            Run Maintenance
          </button>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Security</h3>
          </div>
          <p className="text-gray-600 mb-4">Review security logs and access controls.</p>
          <button onClick={handleViewLogs} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
            View Logs
          </button>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-8 h-8 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
          <p className="text-gray-600 mb-4">Test notification systems and alerts.</p>
          <button onClick={handleTestNotification} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg">
            Send Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;