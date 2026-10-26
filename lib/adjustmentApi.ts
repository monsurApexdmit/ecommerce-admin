/**
 * Stock Adjustment API Service
 * Proxied through the Next.js API route (same pattern as transferApi).
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

export type AdjustmentType = 'increase' | 'decrease' | 'set';

export interface CreateAdjustmentData {
  productId: number;
  variantId?: number | null;
  locationId: number;
  type: AdjustmentType;
  quantity: number;
  reason: string;
  note?: string;
}

export interface AdjustmentResult {
  id: number;
  productId: number;
  productName: string;
  variantId: number | null;
  locationId: number;
  type: AdjustmentType;
  quantity: number;
  delta: number;
  before: number;
  after: number;
  reason: string;
}

export interface AdjustmentLogRow {
  id: number;
  number: string;
  productId: number;
  productName: string;
  variantId: number | null;
  variantName: string | null;
  locationId: number;
  locationName: string | null;
  type: AdjustmentType;
  delta: number;
  before: number | null;
  after: number | null;
  reason: string;
  note: string | null;
  flagged: boolean;
  unitCost: number | null;
  valueImpact: number | null;
  createdBy: string | null;
  createdAt: string | null;
}

export interface AdjustmentStats { added30d: number; removed30d: number; shrinkageValue30d: number }

export interface AdjustmentRow {
  id: number;
  productId: number;
  productName: string;
  variantId: number | null;
  variantName: string | null;
  locationId: number;
  locationName: string | null;
  quantity: number; // signed delta
  notes: string | null;
  createdBy: number | null;
  createdAt: string | null;
}

export interface AdjustmentListResponse {
  success: boolean;
  message: string;
  data: AdjustmentRow[];
  meta?: { total: number; per_page: number; current_page: number; last_page: number };
}

export const adjustmentApi = {
  getAll: async (): Promise<AdjustmentListResponse> => {
    const response = await api.get('/adjustments');
    return response.data;
  },

  getLog: async (params?: { reason?: string; location_id?: number; page?: number; per_page?: number }): Promise<{
    data: AdjustmentLogRow[]; stats: AdjustmentStats; total: number; lastPage: number; reasons: string[];
  }> => {
    const response = await api.get('/adjustments', { params });
    const body = response.data;
    return {
      data: body.data ?? [],
      stats: body.stats ?? body.meta?.stats ?? { added30d: 0, removed30d: 0, shrinkageValue30d: 0 },
      total: body.meta?.total ?? (body.data ?? []).length,
      lastPage: body.meta?.last_page ?? 1,
      reasons: body.reasons ?? body.meta?.reasons ?? [],
    };
  },

  create: async (data: CreateAdjustmentData): Promise<{ message: string; data: AdjustmentResult }> => {
    const response = await api.post('/adjustments', data);
    return response.data;
  },
};

export default adjustmentApi;
