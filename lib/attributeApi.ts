/**
 * Attribute API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';

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

export interface AttributeResponse {
  id: number;
  name: string;
  display_name: string;
  option_type: string;
  values: string;
  status: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface AttributeListResponse {
  message: string;
  data: AttributeResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CreateAttributeData {
  name: string;
  display_name: string;
  option_type: string;
  values: string;
  status?: boolean;
}

export interface UpdateAttributeData {
  name?: string;
  display_name?: string;
  option_type?: string;
  values?: string;
  status?: boolean;
}

export const attributeApi = {
  /**
   * Get all attributes
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<AttributeListResponse> => {
    const response = await api.get('/attributes/', { params });
    return response.data;
  },

  /**
   * Get single attribute
   */
  getById: async (id: number): Promise<{ message: string; data: AttributeResponse }> => {
    const response = await api.get(`/attributes/${id}`);
    return response.data;
  },

  /**
   * Create attribute
   */
  create: async (data: CreateAttributeData): Promise<{ message: string; data: AttributeResponse }> => {
    const response = await api.post('/attributes/', data);
    return response.data;
  },

  /**
   * Update attribute
   */
  update: async (id: number, data: UpdateAttributeData): Promise<{ message: string; data: AttributeResponse }> => {
    const response = await api.put(`/attributes/${id}`, data);
    return response.data;
  },

  /**
   * Delete attribute
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/attributes/${id}`);
    return response.data;
  },

  /**
   * Get simple list for dropdowns (no pagination overhead)
   */
  getSimple: async (): Promise<{ message: string; data: AttributeResponse[] }> => {
    const response = await api.get('/attributes/simple');
    return response.data;
  },

  /**
   * Toggle attribute status
   */
  toggleStatus: async (id: number): Promise<{ message: string; data: AttributeResponse }> => {
    const response = await api.patch(`/attributes/${id}/toggle-status`);
    return response.data;
  },

  /**
   * Bulk delete attributes
   */
  bulkDelete: async (ids: number[]): Promise<{ message: string }> => {
    const response = await api.post('/attributes/bulk-delete', { ids });
    return response.data;
  },

  /**
   * Get attribute stats
   */
  getStats: async (): Promise<{ message: string; data: any }> => {
    const response = await api.get('/attributes/stats');
    return response.data;
  },
};

export default attributeApi;
