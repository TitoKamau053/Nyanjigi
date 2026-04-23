import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
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

export default function MeterReadings() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [customers, setCustomers] = useState<CustomerReading[]>([]);
  const [readings, setReadings] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/admin/meter-readings/customers?month=${month}`);
      setCustomers(res.data.data);
      
      const initialReadings: Record<number, string> = {};
      res.data.data.forEach((c: CustomerReading) => {
        if (c.already_recorded_reading !== null) {
          initialReadings[c.customer_id] = String(c.already_recorded_reading);
        }
      });
      setReadings(initialReadings);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to fetch customers', 'error');
    }
  };

  useEffect(() => { 
    fetchCustomers(); 
  }, [month]);

  const handleReadingChange = (customerId: number, value: string) => {
    setReadings(prev => ({ ...prev, [customerId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload = customers.map(c => ({
      customer_id: c.customer_id,
      previous_reading: c.previous_reading,
      current_reading: readings[c.customer_id] !== undefined ? readings[c.customer_id] : null
    })).filter(r => r.current_reading !== null && r.current_reading !== '');

    if (payload.length === 0) {
      addToast('No readings entered to save.', 'error');
      setIsSaving(false);
      return;
    }

    try {
      await api.post('/admin/meter-readings', { month, readings: payload });
      addToast(`Successfully saved ${payload.length} meter readings!`, 'success');
      fetchCustomers(); 
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to save readings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Monthly Field Readings</h2>
        <div className="flex gap-4">
          <input 
            type="date" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
          />
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:bg-blue-400"
          >
            {isSaving ? 'Saving...' : 'Save Readings'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meter No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prev Reading</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Reading</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumption</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((c) => {
               const current = parseFloat(readings[c.customer_id] || '0');
               const previous = parseFloat(String(c.previous_reading || 0));
               const consumption = current > previous ? (current - previous).toFixed(2) : '0.00';
               
               return (
                <tr key={c.customer_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.account_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {c.meter_number || <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{previous}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Enter reading"
                      className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1.5 border w-32"
                      value={readings[c.customer_id] || ''}
                      onChange={(e) => handleReadingChange(c.customer_id, e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {readings[c.customer_id] ? (
                       <span className={current < previous ? 'text-red-500' : 'text-green-600'}>
                         {consumption} units
                       </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No active customers found for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}