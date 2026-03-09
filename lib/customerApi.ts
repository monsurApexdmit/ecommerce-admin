/**
 * Customer API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';

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
    return response.data;
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
};

export default customerApi;
