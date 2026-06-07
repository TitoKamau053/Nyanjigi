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
  // Get all customers with filters and pagination
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

  // Get customer statistics
  getCustomerStats: () => 
    api.get('/customers/stats'),

  // Search customers by query
  searchCustomers: (q: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams({ q });
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/customers/search?${query.toString()}`);
  },

  // Get specific customer details
  getCustomerById: (id: number) => 
    api.get(`/customers/${id}`),

  // Create new customer (Updated with initial_balance)
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
    initial_balance?: number; // [FIX] Added this field
  }) => api.post('/customers', data),

  // Update customer information
  updateCustomer: (id: number, data: { 
    full_name?: string; 
    phone?: string; 
    email?: string; 
    location?: string;
  }) => api.put(`/customers/${id}`, data),

  // Toggle customer status (active/inactive)
  toggleCustomerStatus: (id: number) => 
    api.post(`/customers/${id}/toggle-status`),

  // Reset customer password
  resetCustomerPassword: (id: number) => 
    api.post(`/customers/${id}/reset-password`),

  // Adjust balance for a customer
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
  // Generate monthly bills for all customers
  generateBills: (data: { billing_month: string }) => // YYYY-MM-DD
    api.post('/bills/generate', data),

  // Generate bill for specific customer
  generateCustomerBill: (customerId: number, data: { billing_month: string }) => 
    api.post(`/bills/generate/${customerId}`, data),

  // Preview bill generation before executing
  previewBills: (data: { billing_month: string }) => 
    api.post('/bills/preview', data),

  // Get all bills with filters and pagination
  getBills: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue' | 'partially_paid';
    month?: string; // YYYY-MM format
    customer_id?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.month) query.append('month', params.month);
    if (params?.customer_id) query.append('customer_id', params.customer_id.toString());
    return api.get(`/bills?${query.toString()}`);
  },

  // Get billing statistics
  getBillStats: () => 
    api.get('/bills/stats'),

  // Get overdue bills
  getOverdueBills: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/bills/overdue?${query.toString()}`);
  },

  // Get monthly billing summary
  getBillSummary: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return api.get(`/bills/summary${query}`);
  },

  // Export bills data
  exportBills: (params?: { 
    format?: 'json' | 'csv'; 
    month?: string; 
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.format) query.append('format', params.format);
    if (params?.month) query.append('month', params.month);
    if (params?.status) query.append('status', params.status);
    return api.get(`/bills/export?${query.toString()}`, { responseType: 'blob' });
  },

  // Get specific bill details
  getBillById: (billId: number) => 
    api.get(`/bills/${billId}`),

  // Update bill status
  updateBillStatus: (billId: number, data: { 
    status: 'paid' | 'pending' | 'overdue' | 'partially_paid';
  }) => api.put(`/bills/${billId}/status`, data),

  // Delete bill (use with caution)
  deleteBill: (billId: number, data: { confirm: true }) => 
    api.delete(`/bills/${billId}`, { data }),

  // Bulk update bill status
  bulkUpdateBillStatus: (data: { 
    bill_ids: number[]; 
    status: 'paid' | 'pending' | 'overdue' | 'partially_paid';
  }) => api.put('/bills/bulk/status', data),

  // Get bills for specific customer
  getCustomerBills: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/bills/customer/${customerId}?${query.toString()}`);
  },

  // Get billing summary for specific customer
  getCustomerBillSummary: (customerId: number) => 
    api.get(`/bills/customer/${customerId}/summary`),


  // FINES MANAGEMENT
  // Get all applied fines
  getFines: (params?: { 
    page?: number; 
    limit?: number;
    status?: 'pending' | 'paid' | 'waived';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    return api.get(`/fines?${query.toString()}`);
  },

  // Get all fine types
  getFineTypes: () => 
    api.get('/fines/types'),

  // Get fines for specific customer
  getCustomerFines: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/fines/customer/${customerId}?${query.toString()}`);
  },

  // Get fine details by ID
  getFineById: (fineId: number) => 
    api.get(`/fines/${fineId}`),

  // Apply new fine to customer
  applyFine: (data: {
    customerId: number;
    fineTypeId: number;
    amount: number;
    reason: string;
    appliedDate: string; // YYYY-MM-DD
  }) => api.post('/fines', data),

  // Update fine status
  updateFineStatus: (fineId: number, data: { 
    status: 'pending' | 'paid' | 'waived';
  }) => api.put(`/fines/${fineId}/status`, data),


  // PAYMENT MANAGEMENT (Equity Bank)
  // Get all payment transactions
  getPayments: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'completed' | 'pending' | 'failed';
    start_date?: string;
    end_date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return api.get(`/payments/all?${query.toString()}`);
  },
  // Check payment status by reference
  getPaymentStatus: (reference: string) => 
    api.get(`/payments/status/${reference}`),

  // Get available payment methods
  getPaymentMethods: () => 
    api.get('/payments/methods'),


  // EQUITY BANK INTEGRATION
  // Get customer Equity payment history
  getEquityPaymentHistory: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/equity/payment-history/${customerId}?${query.toString()}`);
  },


  // CONTRIBUTION MANAGEMENT
  // Generate monthly contributions for all customers
  generateContributions: (data: { contribution_month: string }) => // YYYY-MM-DD
    api.post('/contributions/generate', data),

  // Bulk generate contributions for specific customers
  bulkGenerateContributions: (data: { 
    month: string; // YYYY-MM-DD
    customer_ids: number[];
  }) => api.post('/contributions/bulk-generate', data),

  // Get all contributions with filters
  getContributions: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue';
    month?: string; // YYYY-MM format
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.month) query.append('month', params.month);
    return api.get(`/contributions?${query.toString()}`);
  },

  // Get contribution dashboard data
  getContributionDashboard: () => 
    api.get('/contributions/dashboard'),

  // Get contribution statistics
  getContributionStats: () => 
    api.get('/contributions/stats'),

  // Get overdue contributions
  getOverdueContributions: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/contributions/overdue?${query.toString()}`);
  },

  // Get monthly contribution summary
  getContributionSummary: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return api.get(`/contributions/summary${query}`);
  },

  // Update contribution amount
  updateContributionAmount: (data: { amount: number }) => 
    api.put('/contributions/amount', data),

  // Mark contribution as paid
  markContributionPaid: (id: number) => 
    api.post(`/contributions/${id}/mark-paid`),

  // Mark contribution as partially paid
  markContributionPartiallyPaid: (id: number, data?: { notes?: string }) =>
    api.post(`/contributions/${id}/mark-partial`, data || {}),

  // Mark contribution as fully paid
  markContributionFullyPaid: (id: number, data?: { notes?: string }) =>
    api.post(`/contributions/${id}/mark-fully-paid`, data || {}),

  // Get contributions pending payment marking
  getContributionsPendingMarkup: (params?: {
    page?: number;
    limit?: number;
    customer_id?: number;
    month?: string;
    zone?: 'Nyakahura' | 'G3' | 'Githunguri';
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
    page?: number;
    limit?: number;
    customer_id?: number;
    payment_type?: 'bill' | 'contribution' | 'fine' | 'advance';
    date_from?: string;
    date_to?: string;
    search?: string;
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

  // Get receipt by ID
  getReceiptById: (receiptId: number) =>
    api.get(`/receipts/${receiptId}`),

  // Get customer receipts
  getCustomerReceipts: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/receipts/customer/${customerId}?${query.toString()}`);
  },

  // Get receipt summary
  getReceiptSummary: (params?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    return api.get(`/receipts/summary?${query.toString()}`);
  },

  // Search receipts
  searchReceipts: (q: string, limit?: number) => {
    const query = new URLSearchParams({ q });
    if (limit) query.append('limit', limit.toString());
    return api.get(`/receipts/search?${query.toString()}`);
  },


  // NOTIFICATIONS
  sendNotifications: (data: {
    notification_type: 'bill' | 'contribution' | 'fine' | 'overdue';
    message: string;
    customer_ids?: number[];
    send_to_all?: boolean;
  }) => api.post('/notifications/send', data),

  getNotificationHistory: (params?: {
    page?: number;
    limit?: number;
    notification_type?: 'bill' | 'contribution' | 'fine' | 'overdue';
    start_date?: string;
    end_date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.notification_type) query.append('notification_type', params.notification_type);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return api.get(`/notifications/history?${query.toString()}`);
  },

  getCustomersForNotification: (params?: { 
    search?: string; 
    zone?: string; 
    page?: number; 
    limit?: number;
    all?: boolean;
  }) => {
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
  
  bulkUpdateSettings: (data: { settings: Record<string, any> }) => 
    api.put('/settings/bulk', data),

  // Manual System Actions 
  runSystemMaintenance: () => api.post('/settings/maintenance/run'),
  
  getSecurityLogs: () => api.get('/settings/logs/security'),
  
  sendTestNotification: (phone?: string) => api.post('/settings/notifications/test', { phone_number: phone }),
  
  initializeSettings: () => api.post('/settings/initialize'),

  // Config Getters/Setters
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
  getDashboard: () => api.get('/admin/dashboard'),
  
  getRevenueAnalytics: (period: string) => api.get(`/admin/revenue-analytics?period=${period}`),
  
  getFinancialSummary: (period: string) => api.get(`/admin/financial-summary?period=${period}`),
  
  getSystemHealth: () => api.get('/admin/system-health'), // Mapped to AdminController.getSystemHealth
  
  getActivityLog: (page: number = 1, limit: number = 20) => api.get(`/admin/activity-log?page=${page}&limit=${limit}`), // Mapped to AdminController.getActivityLog


  // NOTIFICATIONS (SMS)
  getSmsStatus: () => api.get('/admin/sms/status'),
  sendSms: (data: any) => api.post('/admin/sms/send', data),
};