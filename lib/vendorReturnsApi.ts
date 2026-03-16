/**
 * Vendor Returns API Service
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

export type VendorReturnStatus = 'pending' | 'shipped' | 'received_by_vendor' | 'completed';

export interface VendorReturnItem {
  id?: number;
  vendorReturnId?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  reason: string;
}

export interface VendorReturnResponse {
  id: number;
  returnNumber?: string;
  vendorId: number;
  vendorName?: string;
  status: VendorReturnStatus;
  creditType?: string;
  totalAmount?: number;
  notes?: string;
  createdBy?: string;
  returnDate?: string;
  completedDate?: string;
  items?: VendorReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface VendorReturnStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    shipped: number;
    received_by_vendor: number;
    completed: number;
    total_credit_amount?: number;
    totalCreditAmount?: number;
  };
}

export interface VendorReturnListResponse {
  message: string;
  data: VendorReturnResponse[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
  total?: number;
}

export interface CreateVendorReturnData {
  vendorId: number;
  vendorName?: string;
  creditType?: string;
  notes?: string;
  returnDate?: string;
  totalAmount?: number;
  items: {
    productId: number;
    productName?: string;
    variantId?: number;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    reason: string;
  }[];
}

export const vendorReturnsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    vendorId?: number;
  }): Promise<VendorReturnListResponse> => {
    const response = await api.get('/vendor-returns', { params });
    return response.data;
  },

  getStats: async (): Promise<VendorReturnStatsResponse> => {
    const response = await api.get('/vendor-returns/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.get(`/vendor-returns/${id}`);
    return response.data;
  },

  getByVendor: async (vendorId: number): Promise<VendorReturnListResponse> => {
    const response = await api.get(`/vendor-returns/vendor/${vendorId}`);
    return response.data;
  },

  create: async (data: CreateVendorReturnData): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.post('/vendor-returns', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateVendorReturnData>): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.put(`/vendor-returns/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: number, status: VendorReturnStatus): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.patch(`/vendor-returns/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/vendor-returns/${id}`);
    return response.data;
  },
};

export default vendorReturnsApi;
