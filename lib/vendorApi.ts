/**
 * Vendor API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor for auth
api.interceptors.request.use(
  (config) => {
    // Check if running in browser (not SSR)
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

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      // Optionally redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface VendorResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  status: string;
  description: string;
  totalPaid: number;
  amountPayable: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface VendorListResponse {
  message: string;
  data: VendorResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CreateVendorData {
  name: string;
  email: string;
  phone: string;
  address?: string;
  logo?: string;
  status?: string;
  description?: string;
  totalPaid?: number;
  amountPayable?: number;
}

export interface UpdateVendorData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
  description?: string;
  totalPaid?: number;
  amountPayable?: number;
}

export const vendorApi = {
  /**
   * Get all vendors
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<VendorListResponse> => {
    const response = await api.get('/vendors/', { params });
    return response.data;
  },

  /**
   * Get single vendor
   */
  getById: async (id: number): Promise<{ message: string; data: VendorResponse }> => {
    const response = await api.get(`/vendors/${id}`);
    return response.data;
  },

  /**
   * Create vendor
   */
  create: async (data: CreateVendorData): Promise<{ message: string; data: VendorResponse }> => {
    const response = await api.post('/vendors/', data);
    return response.data;
  },

  /**
   * Update vendor
   */
  update: async (id: number, data: UpdateVendorData): Promise<{ message: string; data: VendorResponse }> => {
    const response = await api.put(`/vendors/${id}`, data);
    return response.data;
  },

  /**
   * Delete vendor
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/vendors/${id}`);
    return response.data;
  },
};

export default vendorApi;
