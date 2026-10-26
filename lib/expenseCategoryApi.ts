/**
 * Expense Category API Service
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

export interface ExpenseCategoryResponse {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  color?: string | null;
  monthlyBudget?: number | null;
  type?: string;
  status?: boolean;
  /** True for the payroll-managed Salaries category (cannot be renamed, deactivated or deleted). */
  system?: boolean;
  spentThisMonth?: number;
  countThisMonth?: number;
  allTimeSpent?: number;
  allTimeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategoryStats {
  activeCount: number;
  inactiveCount: number;
  monthTotal: number;
  monthCount: number;
  budgetTotal: number;
  budgetUsedPct: number | null;
  overBudgetCount: number;
}

export interface ExpenseCategoryListResponse {
  message: string;
  data: ExpenseCategoryResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CreateExpenseCategoryData {
  name: string;
  description?: string;
  color?: string;
  monthlyBudget?: number | null;
  type?: string;
  status?: boolean;
}

export interface UpdateExpenseCategoryData {
  name?: string;
  description?: string;
  color?: string;
  monthlyBudget?: number | null;
  type?: string;
  status?: boolean;
}

export const expenseCategoryApi = {
  /** Categories with this-month / all-time spend and budget stats. */
  getOverview: async (params?: { search?: string; include_inactive?: boolean }): Promise<{ data: ExpenseCategoryResponse[]; stats: ExpenseCategoryStats }> => {
    const response = await api.get('/expense-categories/', { params: { limit: 500, ...params } });
    const raw = response.data.data;
    const rows = Array.isArray(raw) ? raw : raw?.data ?? [];
    const meta = response.data.meta ?? raw?.meta ?? {};
    return { data: rows, stats: meta.stats ?? { activeCount: 0, inactiveCount: 0, monthTotal: 0, monthCount: 0, budgetTotal: 0, budgetUsedPct: null, overBudgetCount: 0 } };
  },

  /**
   * Get all expense categories
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ExpenseCategoryListResponse> => {
    const response = await api.get('/expense-categories/', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
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
   * Get single expense category
   */
  getById: async (id: number): Promise<{ message: string; data: ExpenseCategoryResponse }> => {
    const response = await api.get(`/expense-categories/${id}`);
    return response.data;
  },

  /**
   * Create expense category
   */
  create: async (data: CreateExpenseCategoryData): Promise<{ message: string; data: ExpenseCategoryResponse }> => {
    const response = await api.post('/expense-categories/', data);
    return response.data;
  },

  /**
   * Update expense category
   */
  update: async (id: number, data: UpdateExpenseCategoryData): Promise<{ message: string; data: ExpenseCategoryResponse }> => {
    const response = await api.put(`/expense-categories/${id}`, data);
    return response.data;
  },

  /**
   * Delete expense category
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/expense-categories/${id}`);
    return response.data;
  },
};

export default expenseCategoryApi;
