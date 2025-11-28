/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';

export const authService = {
  // Admin Authentication
  adminLogin: (credentials: { username: string; password: string }) => 
    api.post('/auth/admin/login', credentials),
  
  getAdminProfile: () => 
    api.get('/auth/admin/profile'),
  
  updateAdminProfile: (data: { username?: string; email?: string }) => 
    api.put('/auth/admin/profile', data),
  
  changeAdminPassword: (data: { current_password: string; new_password: string }) => 
    api.post('/auth/admin/change-password', data),

  // Customer Authentication
  customerLogin: (credentials: { account_number: string; password: string }) => 
    api.post('/auth/customer/login', credentials),
  
  getCustomerProfile: () => 
    api.get('/auth/customer/profile'),
  
  updateCustomerProfile: (data: { full_name?: string; phone?: string; email?: string }) => 
    api.put('/auth/customer/profile', data),
  
  changeCustomerPassword: (data: { current_password: string; new_password: string }) => 
    api.post('/auth/customer/change-password', data),

  // Customer Dashboard
  getCustomerDashboard: () => 
    api.get('/auth/customer/dashboard'),

  // Generic methods for backward compatibility
  login: (credentials: any, userType: 'admin' | 'customer') => {
    if (userType === 'admin') {
      return authService.adminLogin(credentials);
    }
    return authService.customerLogin(credentials);
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },

  getProfile: (userType: 'admin' | 'customer') => {
    if (userType === 'admin') {
      return authService.getAdminProfile();
    }
    return authService.getCustomerProfile();
  },

  updateProfile: (data: any, userType: 'admin' | 'customer') => {
    if (userType === 'admin') {
      return authService.updateAdminProfile(data);
    }
    return authService.updateCustomerProfile(data);
  },

  changePassword: (data: any, userType: 'admin' | 'customer') => {
    if (userType === 'admin') {
      return authService.changeAdminPassword(data);
    }
    return authService.changeCustomerPassword(data);
  }
};