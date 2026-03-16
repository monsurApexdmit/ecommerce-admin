/**
 * Coupon API Service
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
    // When sending FormData, remove the default Content-Type so the browser
    // sets it automatically with the correct multipart boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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

// Raw shape returned by the backend (snake_case)
export interface CouponResponse {
  id: number;
  campaign_name: string;
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  status: boolean;         // true = active, false = inactive/expired
  image: string;
  start_date: string;
  end_date: string;
  usage_limit: number | null;
  usage_limit_per_user: number | null;
  times_used: number;
  min_order_amount: number;
  max_discount: number | null;
  applicable_to_categories: string;
  applicable_to_products: string;
  free_shipping: boolean;
  stackable: boolean;
  auto_apply: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CouponListResponse {
  message: string;
  data: CouponResponse[];
}

export interface CreateCouponData {
  campaign_name: string;   // required, min 3 chars
  code: string;            // required, alphanumeric only
  type: 'percentage' | 'fixed' | 'free_shipping';
  discount: number;        // required, > 0
  status?: boolean;
  start_date?: string;     // RFC3339 e.g. "2026-01-01T00:00:00Z"
  end_date?: string;       // RFC3339, must be after start_date
  min_order_amount?: number;
  usage_limit?: number;
}

export interface UpdateCouponData {
  campaign_name?: string;
  code?: string;
  type?: 'percentage' | 'fixed' | 'free_shipping';
  discount?: number;
  status?: boolean;
  start_date?: string;     // RFC3339
  end_date?: string;       // RFC3339
  min_order_amount?: number;
  usage_limit?: number;
}

export const couponApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<CouponListResponse> => {
    const response = await api.get('/coupons', { params });
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: CouponResponse }> => {
    const response = await api.get(`/coupons/${id}`);
    return response.data;
  },

  create: async (data: CreateCouponData): Promise<{ message: string; data: CouponResponse }> => {
    const response = await api.post('/coupons', data);
    return response.data;
  },

  createWithImage: async (data: CreateCouponData & { image: File }): Promise<{ message: string; data: CouponResponse }> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'image') {
        formData.append('image', value as File);
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    const response = await api.post('/coupons/with-image', formData);
    return response.data;
  },

  update: async (id: number, data: UpdateCouponData): Promise<{ message: string; data: CouponResponse }> => {
    const response = await api.put(`/coupons/${id}`, data);
    return response.data;
  },

  updateWithImage: async (id: number, data: UpdateCouponData & { image: File }): Promise<{ message: string; data: CouponResponse }> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'image') {
        formData.append('image', value as File);
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    const response = await api.put(`/coupons/${id}/with-image`, formData);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/coupons/${id}`);
    return response.data;
  },

  validate: async (code: string, orderAmount?: number): Promise<{ message: string; data: CouponResponse; discount: number }> => {
    const response = await api.post('/coupons/validate', { code, order_amount: orderAmount });
    return response.data;
  },

  getByCode: async (code: string): Promise<{ message: string; data: CouponResponse }> => {
    const response = await api.get(`/coupons/by-code/${code}`);
    return response.data;
  },
};

export default couponApi;
