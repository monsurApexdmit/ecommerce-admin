/**
 * Coupon API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
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
    // For FormData let browser set Content-Type with boundary automatically
    // For everything else default to JSON
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
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

// Raw shape returned by the backend (camelCase from Laravel DTO)
export interface CouponResponse {
  id: number;
  companyId: number;
  campaignName: string;
  code: string;
  discount: number;
  type: 'percentage' | 'fixed' | 'free_shipping';
  status: boolean;         // true = active, false = inactive/expired
  image: string | null;
  startDate: string;
  endDate: string;
  uploadedBy?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  timesUsed: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  applicableToCategories?: string | null;
  applicableToProducts?: string | null;
  freeShipping: boolean;
  stackable: boolean;
  autoApply: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
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
    // Laravel returns: { success, message, data: [...], meta: { total, per_page, current_page } }
    return {
      message: response.data.message || '',
      data: Array.isArray(response.data.data) ? response.data.data : [],
    };
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
    try {
      const formData = new FormData();
      const { image, ...otherData } = data as any;

      for (const [key, value] of Object.entries(otherData)) {
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'boolean') {
            formData.append(key, value ? '1' : '0');
          } else {
            formData.append(key, String(value));
          }
        }
      }
      if (image) formData.append('image', image);

      // Use fetch directly - axios serializes FormData incorrectly
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const companyId = typeof window !== 'undefined' ? localStorage.getItem('company_id') : null;
      const url = `/api/proxy/coupons/with-image${companyId ? `?company_id=${companyId}` : ''}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        const err: any = new Error(json.message || 'Create failed');
        err.response = { status: res.status, data: json };
        throw err;
      }
      return json;
    } catch (error: any) {
      console.error('createWithImage error:', error.response?.status, error.response?.data);
      throw error;
    }
  },

  update: async (id: number, data: UpdateCouponData): Promise<{ message: string; data: CouponResponse }> => {
    const response = await api.put(`/coupons/${id}`, data);
    return response.data;
  },

  updateWithImage: async (id: number, data: UpdateCouponData & { image?: File }): Promise<{ message: string; data: CouponResponse }> => {
    const formData = new FormData();
    const { image, ...otherData } = data;

    Object.entries(otherData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean') {
          formData.append(key, value ? '1' : '0');
        } else {
          formData.append(key, String(value));
        }
      }
    });

    if (image) {
      formData.append('image', image);
    }

    // Use fetch directly to ensure FormData is sent as multipart/form-data
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const companyId = typeof window !== 'undefined' ? localStorage.getItem('company_id') : null;

    const url = `/api/proxy/coupons/${id}/with-image${companyId ? `?company_id=${companyId}` : ''}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) {
      const err: any = new Error(json.message || 'Update failed');
      err.response = { status: res.status, data: json };
      throw err;
    }
    return json;
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
    const response = await api.get(`/coupons/code/${code}`);
    return response.data;
  },
};

export default couponApi;
