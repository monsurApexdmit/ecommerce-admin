/**
 * Location API Service
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

export interface LocationResponse {
  id: number;
  name: string;
  address: string;
  contactPerson: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationListResponse {
  message: string;
  data: LocationResponse[];
}

export interface CreateLocationData {
  name: string;
  address: string;
  contactPerson?: string;
  isDefault?: boolean;
}

export interface UpdateLocationData {
  name?: string;
  address?: string;
  contactPerson?: string;
  isDefault?: boolean;
}

export const locationApi = {
  getAll: async (): Promise<LocationListResponse> => {
    try {
      const response = await api.get('/locations');
      // Laravel returns: { success, message, data: [] } (simple array)
      const laravelData = response.data.data || [];

      return {
        message: response.data.message || '',
        data: Array.isArray(laravelData) ? laravelData : [],
      };
    } catch (error: any) {
      // Location endpoint has backend issues - return empty data gracefully
      // This prevents the app from crashing while backend is fixed
      return {
        message: '',
        data: [],
      };
    }
  },

  getById: async (id: number): Promise<{ message: string; data: LocationResponse }> => {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  },

  create: async (data: CreateLocationData): Promise<{ message: string; data: LocationResponse }> => {
    const payload: any = { name: data.name, address: data.address };
    if (data.contactPerson !== undefined) payload.contactPerson = data.contactPerson;
    if (data.isDefault !== undefined) payload.isDefault = data.isDefault;
    const response = await api.post('/locations', payload);
    return response.data;
  },

  update: async (id: number, data: UpdateLocationData): Promise<{ message: string; data: LocationResponse }> => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.address !== undefined) payload.address = data.address;
    if (data.contactPerson !== undefined) payload.contactPerson = data.contactPerson;
    if (data.isDefault !== undefined) payload.isDefault = data.isDefault;
    const response = await api.put(`/locations/${id}`, payload);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/locations/${id}`);
    return response.data;
  },
};

export default locationApi;
