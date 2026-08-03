/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';

export const adminService = {
  // AUTHENTICATION
  login: (credentials: { username: string; password: string }) => 
    api.post('/auth/admin/login', credentials),
  
  getProfile: () => 
    api.get('/auth/admin/profile'),
  
  updateProfile: (data: { username?: string; email?: string }) => 
    api.put('/auth/admin/profile', data),
  
  changePassword: (data: { current_password: string; new_password: string }) => 
    api.post('/auth/admin/change-password', data),

  // CUSTOMER MANAGEMENT
  getCustomers: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    zone?: 'Nyakahura' | 'G3' | 'Githunguri';
    status?: 'active' | 'inactive';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.zone) query.append('zone', params.zone);
    if (params?.status) query.append('status', params.status);
    return api.get(`/customers?${query.toString()}`);
  },

  getCustomerStats: () => api.get('/customers/stats'),
  getCustomerById: (id: number) => api.get(`/customers/${id}`),
  
  getZoneFinancialSummary: () => api.get('/customers/analytics/zones'),
  
  createCustomer: (data: { 
    full_name: string; 
    national_id: string;      
    account_number: string;   
    phone: string; 
    email?: string;
    location: string; 
    zone: 'Nyakahura' | 'G3' | 'Githunguri';
    connection_date: string; 
    customer_type: 'normal' | 'institution'; 
    initial_balance?: number;
  }) => api.post('/customers', data),

  updateCustomer: (id: number, data: { 
    full_name?: string; 
    phone?: string; 
    email?: string; 
    location?: string;
  }) => api.put(`/customers/${id}`, data),

  toggleCustomerStatus: (id: number) => api.post(`/customers/${id}/toggle-status`),
  resetCustomerPassword: (id: number) => api.post(`/customers/${id}/reset-password`),
  adjustCustomerBalance: (id: number, data: { amount: number; notes?: string }) => 
    api.post(`/customers/${id}/adjust-balance`, data),

  // METER READINGS
  getMeterReadingCustomers: async (params: { month: string }) => {
    return api.get(`/admin/meter-readings/customers?month=${params.month}-01`);
  },

  saveMeterReadings: async (data: { month: string; readings: any[] }) => {
    const normalizedMonth = data.month.length === 7 ? `${data.month}-01` : data.month;
    return api.post('/admin/meter-readings', { ...data, month: normalizedMonth });
  },

  // BILLING MANAGEMENT
  generateBills: (data: { billing_month: string }) => api.post('/bills/generate', data),
  generateCustomerBill: (customerId: number, data: { billing_month: string }) => api.post(`/bills/generate/${customerId}`, data),
  previewBills: (data: { billing_month: string }) => api.post('/bills/preview', data),

  getBills: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue' | 'partially_paid';
    month?: string;
    customer_id?: number;
    search?: string; // Added search parameter
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.month) query.append('month', params.month);
    if (params?.customer_id) query.append('customer_id', params.customer_id.toString());
    if (params?.search) query.append('search', params.search);
    return api.get(`/bills?${query.toString()}`);
  },

  getBillStats: () => api.get('/bills/stats'),
  
  getOverdueBills: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/bills/overdue?${query.toString()}`);
  },

  getBillSummary: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return api.get(`/bills/summary${query}`);
  },

  exportBills: (params?: { format?: 'json' | 'csv'; month?: string; status?: string; }) => {
    const query = new URLSearchParams();
    if (params?.format) query.append('format', params.format);
    if (params?.month) query.append('month', params.month);
    if (params?.status) query.append('status', params.status);
    return api.get(`/bills/export?${query.toString()}`, { responseType: 'blob' });
  },

  getBillById: (billId: number) => api.get(`/bills/${billId}`),
  updateBillStatus: (billId: number, data: { status: 'paid' | 'pending' | 'overdue' | 'partially_paid'; }) => api.put(`/bills/${billId}/status`, data),
  deleteBill: (billId: number, data: { confirm: true }) => api.delete(`/bills/${billId}`, { data }),
  bulkUpdateBillStatus: (data: { bill_ids: number[]; status: 'paid' | 'pending' | 'overdue' | 'partially_paid'; }) => api.put('/bills/bulk/status', data),
  
  getCustomerBills: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/bills/customer/${customerId}?${query.toString()}`);
  },
  getCustomerBillSummary: (customerId: number) => api.get(`/bills/customer/${customerId}/summary`),

  // FINES MANAGEMENT
  getFines: (params?: { 
    page?: number; 
    limit?: number;
    status?: 'pending' | 'paid' | 'waived';
    search?: string; // Added search parameter
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return api.get(`/fines?${query.toString()}`);
  },

  getFineTypes: () => api.get('/fines/types'),
  getCustomerFines: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/fines/customer/${customerId}?${query.toString()}`);
  },
  getFineById: (fineId: number) => api.get(`/fines/${fineId}`),
  applyFine: (data: { customerId: number; fineTypeId: number; amount: number; reason: string; appliedDate: string; }) => api.post('/fines', data),
  updateFineStatus: (fineId: number, data: { status: 'pending' | 'paid' | 'waived'; }) => api.put(`/fines/${fineId}/status`, data),

  // PAYMENT MANAGEMENT
  getPayments: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'completed' | 'pending' | 'failed';
    start_date?: string;
    end_date?: string;
    search?: string; // Added search parameter
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.search) query.append('search', params.search);
    return api.get(`/payments/all?${query.toString()}`);
  },
  
  getPaymentStatus: (reference: string) => api.get(`/payments/status/${reference}`),
  getPaymentMethods: () => api.get('/payments/methods'),
  getEquityPaymentHistory: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/equity/payment-history/${customerId}?${query.toString()}`);
  },

  // CONTRIBUTION MANAGEMENT
  generateContributions: (data: { contribution_month: string }) => api.post('/contributions/generate', data),
  bulkGenerateContributions: (data: { month: string; customer_ids: number[]; }) => api.post('/contributions/bulk-generate', data),
  getContributions: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue';
    month?: string;
    search?: string; // Added search parameter
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.month) query.append('month', params.month);
    if (params?.search) query.append('search', params.search);
    return api.get(`/contributions?${query.toString()}`);
  },

  getContributionDashboard: () => api.get('/contributions/dashboard'),
  getContributionStats: () => api.get('/contributions/stats'),
  getOverdueContributions: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/contributions/overdue?${query.toString()}`);
  },
  getContributionSummary: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return api.get(`/contributions/summary${query}`);
  },
  updateContributionAmount: (data: { amount: number }) => api.put('/contributions/amount', data),
  markContributionPaid: (id: number) => api.post(`/contributions/${id}/mark-paid`),
  markContributionPartiallyPaid: (id: number, data?: { notes?: string }) => api.post(`/contributions/${id}/mark-partial`, data || {}),
  markContributionFullyPaid: (id: number, data?: { notes?: string }) => api.post(`/contributions/${id}/mark-fully-paid`, data || {}),
  getContributionsPendingMarkup: (params?: {
    page?: number; limit?: number; customer_id?: number; month?: string; zone?: 'Nyakahura' | 'G3' | 'Githunguri';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.customer_id) query.append('customer_id', params.customer_id.toString());
    if (params?.month) query.append('month', params.month);
    if (params?.zone) query.append('zone', params.zone);
    return api.get(`/contributions/pending-markup?${query.toString()}`);
  },

  // RECEIPT MANAGEMENT
  getReceipts: (params?: {
    page?: number; limit?: number; customer_id?: number; payment_type?: 'bill' | 'contribution' | 'fine' | 'advance';
    date_from?: string; date_to?: string; search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.customer_id) query.append('customer_id', params.customer_id.toString());
    if (params?.payment_type) query.append('payment_type', params.payment_type);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.search) query.append('search', params.search);
    return api.get(`/receipts?${query.toString()}`);
  },
  getReceiptById: (receiptId: number) => api.get(`/receipts/${receiptId}`),
  getCustomerReceipts: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/receipts/customer/${customerId}?${query.toString()}`);
  },
  getReceiptSummary: (params?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    return api.get(`/receipts/summary?${query.toString()}`);
  },
  searchReceipts: (q: string, limit?: number) => {
    const query = new URLSearchParams({ q });
    if (limit) query.append('limit', limit.toString());
    return api.get(`/receipts/search?${query.toString()}`);
  },

  // NOTIFICATIONS
  sendNotifications: (data: { notification_type: 'bill' | 'contribution' | 'fine' | 'overdue' | 'custom'; message: string; customer_ids?: number[]; send_to_all?: boolean; }) => api.post('/notifications/send', data),
  getNotificationHistory: (params?: { page?: number; limit?: number; notification_type?: 'bill' | 'contribution' | 'fine' | 'overdue' | 'custom'; start_date?: string; end_date?: string; }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.notification_type) query.append('notification_type', params.notification_type);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return api.get(`/notifications/history?${query.toString()}`);
  },
  getCustomersForNotification: (params?: { search?: string; zone?: string; page?: number; limit?: number; all?: boolean; }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.zone) query.append('zone', params.zone);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.all) query.append('all', 'true');
    return api.get(`/notifications/customers?${query.toString()}`);
  },

  // SYSTEM SETTINGS & MAINTENANCE
  getSettings: () => api.get('/settings'),
  getSettingsValidation: () => api.get('/settings/validation'),
  bulkUpdateSettings: (data: { settings: Record<string, any> }) => api.put('/settings/bulk', data),
  runSystemMaintenance: () => api.post('/settings/maintenance/run'),
  getSecurityLogs: () => api.get('/settings/logs/security'),
  sendTestNotification: (phone?: string) => api.post('/settings/notifications/test', { phone_number: phone }),
  initializeSettings: () => api.post('/settings/initialize'),

  // Config
  getBillingConfig: () => api.get('/settings/billing/config'),
  updateBillingConfig: (data: any) => api.put('/settings/billing/config', data),
  getPaymentConfig: () => api.get('/settings/payments/config'),
  updatePaymentConfig: (data: any) => api.put('/settings/payments/config', data),
  getContributionConfig: () => api.get('/settings/contributions/config'),
  updateContributionConfig: (data: any) => api.put('/settings/contributions/config', data),
  getNotificationConfig: () => api.get('/settings/notifications/config'),
  updateNotificationConfig: (data: any) => api.put('/settings/notifications/config', data),
  getCompanyConfig: () => api.get('/settings/company/config'),
  updateCompanyConfig: (data: any) => api.put('/settings/company/config', data),
  testEquityConnection: () => api.post('/settings/payments/test-equity'),

  // DASHBOARD & ANALYTICS
  getDashboardComprehensive: (period: '7d' | '30d' | '90d' | 'yearly' = '30d') => api.get('/admin/dashboard-comprehensive', { params: { period } }),
  getDashboard: () => api.get('/admin/dashboard'),
  getRevenueAnalytics: (period: string) => api.get(`/admin/revenue-analytics?period=${period}`),
  getFinancialSummary: (period: string) => api.get(`/admin/financial-summary?period=${period}`),
  getSystemHealth: () => api.get('/admin/system-health'),
  getActivityLog: (page: number = 1, limit: number = 20) => api.get(`/admin/activity-log?page=${page}&limit=${limit}`),

  // NOTIFICATIONS (SMS)
  getSmsStatus: () => api.get('/admin/sms/status'),
  sendSms: (data: any) => api.post('/admin/sms/send', data),
};