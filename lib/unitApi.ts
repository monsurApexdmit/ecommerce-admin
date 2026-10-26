/**
 * Unit (of measurement) API Service — proxied through the Next.js route.
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

export interface UnitResponse {
  id: number;
  unitName: string;
  symbol: string | null;
  status: boolean;
  type?: 'Count' | 'Weight' | 'Volume' | 'Length';
  conversionQty?: number | null;
  conversionUnitId?: number | null;
  conversion?: string | null;
  usedBy?: number;
  productsCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUnitData {
  unitName: string;
  symbol?: string;
  status?: boolean;
  type?: 'Count' | 'Weight' | 'Volume' | 'Length';
  conversionQty?: number | null;
  conversionUnitId?: number | null;
}

export const unitApi = {
  getAll: async (params?: { search?: string; status?: string; limit?: number }): Promise<{ data: UnitResponse[]; total: number }> => {
    const res = await api.get('/units', { params });
    const d = res.data?.data ?? {};
    return { data: d.data ?? [], total: d.total ?? 0 };
  },

  simple: async (): Promise<UnitResponse[]> => {
    const res = await api.get('/units/simple');
    return res.data?.data ?? [];
  },

  create: async (data: CreateUnitData): Promise<{ message: string; data: UnitResponse }> => {
    const res = await api.post('/units', data);
    return res.data;
  },

  update: async (id: number, data: Partial<CreateUnitData>): Promise<{ message: string; data: UnitResponse }> => {
    const res = await api.put(`/units/${id}`, data);
    return res.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const res = await api.delete(`/units/${id}`);
    return res.data;
  },
};

export default unitApi;
