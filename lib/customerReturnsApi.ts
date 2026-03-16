/**
 * Customer Returns API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;

      // Add company_id for multi-tenant support
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
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

export type CustomerReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface CustomerReturnItem {
  id?: number;
  customerReturnId?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  price?: number;
  reason: string;
}

export interface CustomerReturnResponse {
  id: number;
  returnNumber?: string;
  customerId: number;
  customerName?: string;
  sellId?: number;
  orderNumber?: string;
  status: CustomerReturnStatus;
  refundMethod?: string;
  totalAmount?: number;
  notes?: string;
  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  items?: CustomerReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReturnStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    total_refund_amount?: number;
    totalRefundAmount?: number;
  };
}

export interface CustomerReturnListResponse {
  message: string;
  data: CustomerReturnResponse[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
  total?: number;
}

export interface CreateCustomerReturnData {
  customerId?: number;
  sellId?: number;
  orderNumber?: string;
  refundMethod?: string;
  notes?: string;
  totalAmount?: number;
  items: {
    productId: number;
    variantId?: number;
    quantity: number;
    reason: string;
    price?: number;
  }[];
}

export const customerReturnsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<CustomerReturnListResponse> => {
    const response = await api.get('/customer-returns', { params });
    return response.data;
  },

  getStats: async (): Promise<CustomerReturnStatsResponse> => {
    const response = await api.get('/customer-returns/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.get(`/customer-returns/${id}`);
    return response.data;
  },

  getByCustomer: async (customerId: number): Promise<CustomerReturnListResponse> => {
    const response = await api.get(`/customer-returns/customer/${customerId}`);
    return response.data;
  },

  create: async (data: CreateCustomerReturnData): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.post('/customer-returns', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateCustomerReturnData>): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.put(`/customer-returns/${id}`, data);
    return response.data;
  },

  approve: async (id: number, notes?: string): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.patch(`/customer-returns/${id}/approve`, { notes });
    return response.data;
  },

  reject: async (id: number, reason: string): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.patch(`/customer-returns/${id}/reject`, { rejectionReason: reason });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/customer-returns/${id}`);
    return response.data;
  },
};

export default customerReturnsApi;
