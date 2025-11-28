/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';

export const adminService = {
  // ========================================
  // AUTHENTICATION
  // ========================================
  login: (credentials: { username: string; password: string }) => 
    api.post('/auth/admin/login', credentials),
  
  getProfile: () => 
    api.get('/auth/admin/profile'),
  
  updateProfile: (data: { username?: string; email?: string }) => 
    api.put('/auth/admin/profile', data),
  
  changePassword: (data: { current_password: string; new_password: string }) => 
    api.post('/auth/admin/change-password', data),

  // ========================================
  // CUSTOMER MANAGEMENT
  // ========================================
  
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

  // Create new customer
  createCustomer: (data: { 
    full_name: string; 
    phone: string; 
    email?: string;
    location: string; 
    zone: 'Nyakahura' | 'G3' | 'Githunguri';
    connection_date: string; // YYYY-MM-DD
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

  // ========================================
  // BILLING MANAGEMENT
  // ========================================

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

  // ========================================
  // FINES MANAGEMENT
  // ========================================

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

  // ========================================
  // PAYMENT MANAGEMENT (Equity Bank)
  // ========================================

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

  // ========================================
  // EQUITY BANK INTEGRATION
  // ========================================

  // Get customer Equity payment history
  getEquityPaymentHistory: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/equity/payment-history/${customerId}?${query.toString()}`);
  },

  // ========================================
  // CONTRIBUTION MANAGEMENT
  // ========================================

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

  // ========================================
  // SYSTEM SETTINGS
  // ========================================

  // Get all settings
  getSettings: () => 
    api.get('/settings'),

  // Get settings with validation status
  getSettingsValidation: () => 
    api.get('/settings/validation'),

  // Bulk update settings
  bulkUpdateSettings: (data: { settings: Record<string, any> }) => 
    api.put('/settings/bulk', data),

  // Billing Settings
  getBillingConfig: () => 
    api.get('/settings/billing/config'),

  updateBillingConfig: (data: {
    flat_rate?: number;
    billing_day?: number;
    payment_due_days?: number;
    late_fine_grace_days?: number;
  }) => api.put('/settings/billing/config', data),

  // Payment Settings
  getPaymentConfig: () => 
    api.get('/settings/payments/config'),

  updatePaymentConfig: (data: {
    equity_paybill_account?: string;
    equity_till_account?: string;
    equity_callback_url?: string;
  }) => api.put('/settings/payments/config', data),

  // Test Equity Bank connection
  testEquityConnection: () => 
    api.post('/settings/payments/test-equity'),

  // Contribution Settings
  getContributionConfig: () => 
    api.get('/settings/contributions/config'),

  updateContributionConfig: (data: {
    monthly_amount?: number;
    due_days?: number;
  }) => api.put('/settings/contributions/config', data),

  // Notification Settings
  getNotificationConfig: () => 
    api.get('/settings/notifications/config'),

  updateNotificationConfig: (data: {
    sms_sender_id?: string;
    sms_enabled?: boolean;
    email_enabled?: boolean;
  }) => api.put('/settings/notifications/config', data),

  // Company Settings
  getCompanyConfig: () => 
    api.get('/settings/company/config'),

  updateCompanyConfig: (data: {
    company_name?: string;
    company_phone?: string;
    company_email?: string;
  }) => api.put('/settings/company/config', data),

  // Initialize default settings
  initializeSettings: () => 
    api.post('/settings/initialize'),

  // ========================================
  // DASHBOARD & ANALYTICS (if available)
  // ========================================

  // Get dashboard overview
  getDashboard: () => 
    api.get('/admin/dashboard'),

  // Get system overview
  getSystemOverview: () => 
    api.get('/admin/system-overview'),

  // Get revenue analytics
  getRevenueAnalytics: (period: string) => 
    api.get(`/admin/revenue-analytics?period=${period}`),

  // Get financial summary
  getFinancialSummary: (period: string) => 
    api.get(`/admin/financial-summary?period=${period}`),

  // Get outstanding customers
  getOutstandingCustomers: (limit: number = 10) => 
    api.get(`/admin/outstanding-customers?limit=${limit}`),

  // Get system health
  getSystemHealth: () => 
    api.get('/admin/system-health'),

  // Export customers data
  exportCustomers: (format: 'json' | 'csv' = 'csv') => 
    api.get(`/admin/customers/export?format=${format}`, { responseType: 'blob' }),

  // Get activity log
  getActivityLog: (page: number = 1, limit: number = 20) => 
    api.get(`/admin/activity-log?page=${page}&limit=${limit}`),

  // ========================================
  // NOTIFICATIONS & SMS
  // ========================================

  // Get SMS status
  getSmsStatus: () => 
    api.get('/admin/sms/status'),

  // Send single SMS
  sendSms: (data: { 
    phone_number: string; 
    message: string; 
    sender_id?: string;
  }) => api.post('/admin/sms/send', data),

  // Send bulk SMS
  sendBulkSms: (data: { 
    recipients: string[]; 
    message: string; 
    sender_id?: string;
  }) => api.post('/admin/sms/bulk-send', data),

  // Send bill reminders
  sendBillReminders: (data: { 
    days_overdue?: number; 
    customer_ids?: number[];
  }) => api.post('/admin/notifications/bill-reminders', data),

  // Send payment confirmations
  sendPaymentConfirmations: (data: { payment_ids: number[] }) =>
    api.post('/admin/notifications/payment-confirmations', data),

  // Send custom notifications
  sendCustomNotifications: (data: { 
    customer_ids: number[]; 
    message: string; 
    notification_type?: 'sms' | 'email' | 'both';
  }) => api.post('/admin/notifications/custom', data),

  // Get SMS delivery status
  getSmsDeliveryStatus: (messageId: string) =>
    api.get(`/admin/sms/delivery-status/${messageId}`),
};