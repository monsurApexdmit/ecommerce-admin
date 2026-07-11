/**
 * Customer API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;

        // Add company_id for multi-tenant support
        const companyId = getCompanyId();
        if (companyId) {
          if (!config.params) config.params = {};
          config.params.company_id = companyId;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface CustomerAddress {
  id: number;
  customerId: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  addressType: string;
  isDefault: boolean;
}

export interface CustomerResponse {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  customerType: 'retail' | 'wholesale';
  status: 'active' | 'inactive';
  notes: string;
  storeCredit: number;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  message: string;
  data: CustomerResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  customerType?: 'retail' | 'wholesale';
  status?: 'active' | 'inactive';
  notes?: string;
  storeCredit?: number;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  customerType?: 'retail' | 'wholesale';
  status?: 'active' | 'inactive';
  notes?: string;
  storeCredit?: number;
}

export const customerApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<CustomerListResponse> => {
    const response = await api.get('/customers', { params });
    // Laravel returns { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      total: laravelData.total || 0,
      page: laravelData.current_page || 1,
      limit: laravelData.per_page || 10,
    };
  },

  getById: async (id: number): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  create: async (data: CreateCustomerData): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  update: async (id: number, data: UpdateCustomerData): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  getAddresses: async (customerId: number): Promise<CustomerAddress[]> => {
    const response = await api.get('/shipping-addresses', { params: { customer_id: customerId } });
    return response.data.data || [];
  },

  createAddress: async (data: {
    customerId: number;
    fullName: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    addressType?: string;
    isDefault?: boolean;
  }): Promise<CustomerAddress> => {
    const response = await api.post('/shipping-addresses', data);
    return response.data.data;
  },

  updateAddress: async (id: number, data: Partial<{
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    addressType: string;
    isDefault: boolean;
  }>): Promise<CustomerAddress> => {
    const response = await api.put(`/shipping-addresses/${id}`, data);
    return response.data.data;
  },

  deleteAddress: async (id: number): Promise<void> => {
    await api.delete(`/shipping-addresses/${id}`);
  },

  setDefaultAddress: async (id: number): Promise<CustomerAddress> => {
    const response = await api.patch(`/shipping-addresses/${id}/set-default`);
    return response.data.data;
  },

  getStats: async (): Promise<{
    total: number;
    active: number;
    inactive: number;
    individuals: number;
    businesses: number;
  }> => {
    const response = await api.get('/customers/stats');
    return response.data.data;
  },
};

export default customerApi;
