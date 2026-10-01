/**
 * Customer Due API Service
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

export type AgingBucket = 'current' | '30' | '60' | '90+';

export interface CustomerDueResponse {
  customerId: number;
  customerName: string;
  totalDue: number;
  oldestUnpaidDate: string;
  agingBucket: AgingBucket;
  sellCount: number;
}

export interface DueSummary {
  totalDue: number;
  totalOverdue: number;
  count: number;
}

export interface CustomerDueListResponse {
  message: string;
  data: CustomerDueResponse[];
  summary?: DueSummary;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface VendorDueResponse {
  vendorId: number;
  vendorName: string;
  poNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  agingBucket: AgingBucket;
  daysOld: number;
}

export interface VendorDueListResponse {
  message: string;
  data: VendorDueResponse[];
  summary?: DueSummary;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export const dueApi = {
  /**
   * Get customers who owe money (paginated)
   */
  getCustomerDues: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    aging?: string;
  }): Promise<CustomerDueListResponse> => {
    const response = await api.get('/dues/customers', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page }, summary }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      summary: response.data.summary || undefined,
      pagination: {
        total: laravelData.total || 0,
        page: laravelData.current_page || 1,
        limit: laravelData.per_page || 10,
        total_pages: Math.ceil((laravelData.total || 0) / (laravelData.per_page || 10)),
        has_next: laravelData.current_page < Math.ceil((laravelData.total || 0) / (laravelData.per_page || 10)),
        has_previous: laravelData.current_page > 1,
      },
    };
  },

  /**
   * Get vendors who are owed money on purchase orders (paginated)
   */
  getVendorDues: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    aging?: string;
  }): Promise<VendorDueListResponse> => {
    const response = await api.get('/dues/vendors', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page }, summary }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      summary: response.data.summary || undefined,
      pagination: {
        total: laravelData.total || 0,
        page: laravelData.current_page || 1,
        limit: laravelData.per_page || 10,
        total_pages: Math.ceil((laravelData.total || 0) / (laravelData.per_page || 10)),
        has_next: laravelData.current_page < Math.ceil((laravelData.total || 0) / (laravelData.per_page || 10)),
        has_previous: laravelData.current_page > 1,
      },
    };
  },
};

export default dueApi;
