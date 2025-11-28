/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';

export const customerService = {
  // Authentication - delegated to authService but kept here for convenience
  login: (credentials: { account_number: string; password: string }) => 
    api.post('/auth/customer/login', credentials),
  
  getProfile: () => 
    api.get('/auth/customer/profile'),
  
  updateProfile: (data: { full_name?: string; phone?: string; email?: string }) => 
    api.put('/auth/customer/profile', data),
  
  changePassword: (data: { current_password: string; new_password: string }) => 
    api.post('/auth/customer/change-password', data),
  
  getDashboard: () => 
    api.get('/auth/customer/dashboard'),

  // Bills Management
  getBills: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue' | 'partially_paid';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    return api.get(`/customers/me/bills?${query.toString()}`);
  },

  // Alternative route for getting bills
  getMyBills: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/customers/bills?${query.toString()}`);
  },
  
  getBillById: (billId: number) => 
    api.get(`/customers/me/bills/${billId}`),

  // Payments Management
  getPayments: (params?: { 
    page?: number; 
    limit?: number;
    status?: 'completed' | 'pending' | 'failed';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    return api.get(`/customers/me/payments?${query.toString()}`);
  },
  
  getPaymentById: (paymentId: number) => 
    api.get(`/customers/me/payments/${paymentId}`),

  // Payment History (from payments endpoint)
  getPaymentHistory: (params?: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return api.get(`/payments/history?${query.toString()}`);
  },

  // Check payment status by reference
  getPaymentStatus: (reference: string) => 
    api.get(`/payments/status/${reference}`),

  // Get available payment methods
  getPaymentMethods: () => 
    api.get('/payments/methods'),

  // Contributions Management
  getContributions: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'paid' | 'pending' | 'overdue';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    return api.get(`/customers/me/contributions?${query.toString()}`);
  },

  getContributionById: (id: number) => 
    api.get(`/customers/me/contributions/${id}`),

  // Fines Management
  getFines: (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'pending' | 'paid' | 'waived';
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    return api.get(`/fines/me?${query.toString()}`);
  },
  
  getFineById: (fineId: number) => 
    api.get(`/fines/${fineId}`),

  // Get fine types (for reference)
  getFineTypes: () => 
    api.get('/fines/types'),

  // Account Summary
  getAccountSummary: () => 
    api.get('/customers/me/account-summary'),

  // Equity Bank Payment History
  getEquityPaymentHistory: (customerId: number, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/equity/payment-history/${customerId}?${query.toString()}`);
  },

};