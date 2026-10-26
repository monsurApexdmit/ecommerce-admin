/**
 * Brand API Service — proxied through the Next.js route.
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

export interface BrandResponse {
  id: number;
  brandName: string;
  logo: string | null;
  website?: string | null;
  description?: string | null;
  status: boolean;
  productsCount?: number | null;
  stockValue?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBrandData {
  brandName: string;
  logo?: string;
  website?: string;
  description?: string;
  status?: boolean;
}

export const brandApi = {
  getAll: async (params?: { search?: string; status?: string; limit?: number }): Promise<{ data: BrandResponse[]; total: number; noBrandCount: number }> => {
    const res = await api.get('/brands', { params });
    const d = res.data?.data ?? {};
    return { data: d.data ?? [], total: d.total ?? 0, noBrandCount: d.no_brand_count ?? 0 };
  },

  simple: async (): Promise<BrandResponse[]> => {
    const res = await api.get('/brands/simple');
    return res.data?.data ?? [];
  },

  create: async (data: CreateBrandData): Promise<{ message: string; data: BrandResponse }> => {
    const res = await api.post('/brands', data);
    return res.data;
  },

  update: async (id: number, data: Partial<CreateBrandData>): Promise<{ message: string; data: BrandResponse }> => {
    const res = await api.put(`/brands/${id}`, data);
    return res.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const res = await api.delete(`/brands/${id}`);
    return res.data;
  },
};

export default brandApi;
