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
  categoryName: string;
  parentId: number | null;
  description?: string | null;
  image?: string | null;
  color?: string | null;
  sortOrder?: number;
  parent?: CategoryResponse;
  children?: CategoryResponse[];
  status: boolean;
  productsCount?: number | null;
  createdAt: string;
  updatedAt: string;
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
  description?: string | null;
  image?: string | null;
  color?: string | null;
  imageFile?: File | null;
}

export interface UpdateCategoryData {
  category_name?: string;
  parent_id?: number | null;
  status?: boolean;
  description?: string | null;
  image?: string | null;
  color?: string | null;
  imageFile?: File | null;
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
    // Backend returns: { success, message, data: [...] } directly (not paginated)
    const data = response.data.data;
    return {
      message: response.data.message || '',
      data: Array.isArray(data) ? data : (data?.data || []),
    };
  },

  /**
   * Get simple list (for dropdowns)
   */
  getSimple: async (): Promise<CategoryListResponse> => {
    const response = await api.get('/categories/simple');
    const data = response.data.data;
    return {
      message: response.data.message || '',
      data: Array.isArray(data) ? data : (data?.data || []),
    };
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
    const payload: any = {
      categoryName: data.category_name,
      parentId: data.parent_id === undefined ? null : data.parent_id,
      status: data.status,
    };
    if (data.description !== undefined) payload.description = data.description;
    if (data.color) payload.color = data.color;
    if (data.imageFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });
      fd.append('image', data.imageFile);
      const res = await api.post('/categories/with-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data;
    }
    if (data.image !== undefined) payload.image = data.image;
    const response = await api.post('/categories/', payload);
    return response.data;
  },

  /**
   * Update category
   */
  update: async (id: number, data: UpdateCategoryData): Promise<{ message: string; data: CategoryResponse }> => {
    const payload: any = {};
    if (data.category_name !== undefined) payload.categoryName = data.category_name;
    if ('parent_id' in data) payload.parentId = data.parent_id === undefined ? null : data.parent_id;
    if (data.status !== undefined) payload.status = data.status;
    if (data.description !== undefined) payload.description = data.description;
    if (data.color !== undefined) payload.color = data.color;
    if (data.imageFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });
      fd.append('image', data.imageFile);
      fd.append('_method', 'PUT');
      const res = await api.post(`/categories/${id}/with-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data;
    }
    if (data.image !== undefined) payload.image = data.image;
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
   * Bulk delete: removes what it can; categories with products or sub-categories are kept.
   */
  bulkDelete: async (ids: number[]): Promise<{ deleted: number; kept: number; keptNames: string[] }> => {
    const response = await api.post('/categories/bulk-delete', { ids });
    const d = response.data?.data ?? {};
    return { deleted: d.deleted ?? 0, kept: d.kept ?? 0, keptNames: d.keptNames ?? [] };
  },

  /**
   * Save a manual order for a set of sibling categories (ids in the desired order).
   */
  reorder: async (ids: number[]): Promise<void> => {
    await api.post('/categories/reorder', { ids });
  },
};

export default categoryApi;
