/**
 * Category API Service
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

export interface CategoryResponse {
  id: number;
  category_name: string;
  parent_id: number | null;
  parent?: CategoryResponse;
  children?: CategoryResponse[];
  status: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CategoryListResponse {
  message: string;
  data: CategoryResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CategoryStatsResponse {
  message: string;
  data: {
    total: number;
    active: number;
    inactive: number;
    root_categories: number;
    subcategories: number;
  };
}

export interface CreateCategoryData {
  category_name: string;
  parent_id?: number | null;
  status?: boolean;
}

export interface UpdateCategoryData {
  category_name?: string;
  parent_id?: number | null;
  status?: boolean;
}

export const categoryApi = {
  /**
   * Get all categories with filters
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    view?: 'tree' | 'flat' | 'all';
    include_inactive?: boolean;
  }): Promise<CategoryListResponse> => {
    const response = await api.get('/categories/', { params });
    return response.data;
  },

  /**
   * Get simple list (for dropdowns)
   */
  getSimple: async (): Promise<CategoryListResponse> => {
    const response = await api.get('/categories/simple');
    return response.data;
  },

  /**
   * Get statistics
   */
  getStats: async (): Promise<CategoryStatsResponse> => {
    const response = await api.get('/categories/stats');
    return response.data;
  },

  /**
   * Get single category
   */
  getById: async (id: number): Promise<{ message: string; data: CategoryResponse }> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  /**
   * Create category
   */
  create: async (data: CreateCategoryData): Promise<{ message: string; data: CategoryResponse }> => {
    // Ensure parent_id is explicitly set, even if null
    const payload = {
      ...data,
      parent_id: data.parent_id === undefined ? null : data.parent_id
    };
    const response = await api.post('/categories/', payload);
    return response.data;
  },

  /**
   * Update category
   */
  update: async (id: number, data: UpdateCategoryData): Promise<{ message: string; data: CategoryResponse }> => {
    // Ensure parent_id is explicitly included if provided
    const payload = { ...data };
    if ('parent_id' in data) {
      payload.parent_id = data.parent_id === undefined ? null : data.parent_id;
    }
    const response = await api.put(`/categories/${id}`, payload);
    return response.data;
  },

  /**
   * Toggle status
   */
  toggleStatus: async (id: number): Promise<{ message: string; data: CategoryResponse }> => {
    const response = await api.patch(`/categories/${id}/toggle-status`);
    return response.data;
  },

  /**
   * Delete category
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },

  /**
   * Bulk delete
   */
  bulkDelete: async (ids: number[]): Promise<{ message: string; deleted: number }> => {
    const response = await api.post('/categories/bulk-delete', { ids });
    return response.data;
  },
};

export default categoryApi;
