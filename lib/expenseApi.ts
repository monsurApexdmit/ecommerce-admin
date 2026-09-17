/**
 * Expense API Service
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

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'other';
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface ExpenseResponse {
  id: number;
  companyId: number;
  expenseCategoryId: number;
  categoryName?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  title: string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string | null;
  notes?: string | null;
  receiptPath?: string | null;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency | null;
  recurringEndDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  message: string;
  data: ExpenseResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CreateExpenseData {
  expenseCategoryId: number;
  vendorId?: number | null;
  title: string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  receipt?: File | null;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency | null;
  recurringEndDate?: string | null;
}

export interface UpdateExpenseData {
  expenseCategoryId?: number;
  vendorId?: number | null;
  title?: string;
  amount?: number;
  expenseDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  receipt?: File | null;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency | null;
  recurringEndDate?: string | null;
}

export interface ExpenseStatsResponse {
  totalThisMonth: number;
  totalThisYear: number;
  count: number;
}

// Build a FormData payload when a File is present, otherwise return plain JSON-able object
function buildPayload(data: CreateExpenseData | UpdateExpenseData): FormData | Record<string, any> {
  if (data.receipt instanceof File) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'receipt' && value instanceof File) {
        formData.append('receipt', value);
      } else {
        formData.append(key, String(value));
      }
    });
    return formData;
  }

  const { receipt, ...rest } = data;
  return rest;
}

// Laravel returns nested { category: {id,name}, vendor: {id,name} }; flatten to categoryName/vendorName for display
function mapExpense(raw: any): ExpenseResponse {
  if (!raw) return raw;
  return {
    ...raw,
    categoryName: raw.categoryName ?? raw.category?.name ?? null,
    vendorName: raw.vendorName ?? raw.vendor?.name ?? null,
  };
}

export const expenseApi = {
  /**
   * Get all expenses
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: number;
    vendor_id?: number;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ExpenseListResponse> => {
    const response = await api.get('/expenses/', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: (laravelData.data || []).map(mapExpense),
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
   * Get single expense
   */
  getById: async (id: number): Promise<{ message: string; data: ExpenseResponse }> => {
    const response = await api.get(`/expenses/${id}`);
    return { ...response.data, data: mapExpense(response.data.data) };
  },

  /**
   * Create expense
   */
  create: async (data: CreateExpenseData): Promise<{ message: string; data: ExpenseResponse }> => {
    const payload = buildPayload(data);
    const response = await api.post('/expenses/', payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return { ...response.data, data: mapExpense(response.data.data) };
  },

  /**
   * Update expense
   */
  update: async (id: number, data: UpdateExpenseData): Promise<{ message: string; data: ExpenseResponse }> => {
    const payload = buildPayload(data);
    if (payload instanceof FormData) {
      // Laravel doesn't parse multipart on PUT well; use method spoofing
      payload.append('_method', 'PUT');
      const response = await api.post(`/expenses/${id}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { ...response.data, data: mapExpense(response.data.data) };
    }
    const response = await api.put(`/expenses/${id}`, payload);
    return { ...response.data, data: mapExpense(response.data.data) };
  },

  /**
   * Delete expense
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },

  /**
   * Get expense statistics
   */
  getStats: async (): Promise<ExpenseStatsResponse> => {
    const response = await api.get('/expenses/stats');
    return response.data.data;
  },
};

export default expenseApi;
