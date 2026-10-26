/**
 * Customer Returns API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
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

      // Add company_id for multi-tenant support
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

export type CustomerReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface CustomerReturnItem {
  id?: number;
  customerReturnId?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  price?: number;
  reason: string;
}

export interface CustomerReturnResponse {
  id: number;
  returnNumber?: string;
  customerId: number;
  customerName?: string;
  sellId?: number;
  orderNumber?: string;
  status: CustomerReturnStatus;
  refundMethod?: string;
  totalAmount?: number;
  notes?: string;
  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  items?: CustomerReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReturnStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    total_refund_amount?: number;
    totalRefundAmount?: number;
  };
}

export interface CustomerReturnListResponse {
  message: string;
  data: CustomerReturnResponse[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
  total?: number;
}

export interface CreateCustomerReturnData {
  customerId?: number;
  customerName?: string;
  sellId?: number;
  orderNumber?: string;
  refundMethod?: string;
  notes?: string;
  totalAmount?: number;
  items: {
    productId: number;
    variantId?: number;
    quantity: number;
    reason: string;
    price?: number;
  }[];
}


export interface ReturnLine { name: string; quantity: number; price: number; total: number; reason: string }

export interface CustomerReturnRow {
  id: number
  returnNumber: string
  createdAt: string
  customerId: number | null
  customerName: string | null
  orderId: number | null
  invoiceNo: string | null
  itemsSummary: string
  lines: ReturnLine[]
  reason: string | null
  restocked: boolean
  condition: 'restock' | 'writeoff'
  amount: number
  refundMethod: 'cash' | 'original' | 'credit' | 'none' | string | null
  status: 'pending' | 'completed' | 'rejected' | string
  isRequest: boolean
  locationId: number | null
  locationName: string | null
  note: string | null
  rejectionReason: string | null
  processedAt: string | null
  refundedVia?: string | null
  refundAmount?: number
}

export interface CustomerReturnLogStats {
  returns30d: number
  ordersPct30d: string | null
  pendingCount: number
  pendingAmount: number
  restockedUnits: number
  refundedAmount: number
  refundedCount: number
  topReason: string | null
  topReasonCount: number
  writtenOffValue: number
}

export interface ReturnableOrder {
  id: number
  invoiceNo: string
  customerId: number | null
  customerName: string
  date: string
  amount: number
  ageDays: number
  locationId: number | null
  paidVia?: string | null
  items: { sellItemId: number; productId: number; variantId: number | null; name: string; bought: number; returned: number; returnable: number; price: number }[]
}

export interface CreateReturnRequest {
  orderId: number
  items: { sellItemId?: number; productId: number; variantId?: number | null; quantity: number; price?: number; reason: string }[]
  refundMethod: 'cash' | 'original' | 'credit' | 'none'
  restock: boolean
  locationId?: number
  note?: string
  mode: 'complete' | 'request'
}


export const customerReturnsApi = {
  getLog: async (params?: Record<string, any>): Promise<{
    data: CustomerReturnRow[]; total: number; lastPage: number
    counts: Record<'all' | 'pending' | 'completed' | 'rejected' | 'restocked' | 'written_off', number>
    stats: CustomerReturnLogStats
  }> => {
    const res = await api.get('/customer-returns', { params })
    const raw = res.data.data
    const rows = Array.isArray(raw) ? raw : raw?.data ?? []
    const meta = res.data.meta ?? raw?.meta ?? {}
    return { data: rows, total: meta.total ?? rows.length, lastPage: meta.last_page ?? 1, counts: meta.counts ?? {}, stats: meta.stats ?? {} }
  },
  getReturnableOrders: async (search?: string): Promise<ReturnableOrder[]> => {
    const res = await api.get('/customer-returns/returnable-orders', { params: { search: search || undefined, limit: 20 } })
    return res.data.data ?? []
  },
  createReturn: async (data: CreateReturnRequest): Promise<CustomerReturnRow> => {
    const res = await api.post('/customer-returns', data)
    return res.data.data
  },
  approveReturn: async (id: number): Promise<CustomerReturnRow> => {
    const res = await api.post(`/customer-returns/${id}/approve`)
    return res.data.data
  },
  rejectReturn: async (id: number, reason: string): Promise<CustomerReturnRow> => {
    const res = await api.post(`/customer-returns/${id}/reject`, { reason, notes: reason })
    return res.data.data
  },

  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<CustomerReturnListResponse> => {
    const response = await api.get('/customer-returns', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const rawData = response.data.data;
    const meta = response.data.meta || {};
    const laravelData = Array.isArray(rawData)
      ? { data: rawData, total: meta.total, per_page: meta.per_page, current_page: meta.current_page }
      : rawData || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      pagination: {
        page: laravelData.current_page || 1,
        per_page: laravelData.per_page || 10,
        total: laravelData.total || 0,
      },
      total: laravelData.total || 0,
    };
  },

  getStats: async (): Promise<CustomerReturnStatsResponse> => {
    const response = await api.get('/customer-returns/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.get(`/customer-returns/${id}`);
    return response.data;
  },

  getByCustomer: async (customerId: number): Promise<CustomerReturnListResponse> => {
    const response = await api.get(`/customer-returns/customer/${customerId}`);
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      pagination: {
        page: laravelData.current_page || 1,
        per_page: laravelData.per_page || 10,
        total: laravelData.total || 0,
      },
      total: laravelData.total || 0,
    };
  },

  create: async (data: CreateCustomerReturnData): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.post('/customer-returns', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateCustomerReturnData>): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.put(`/customer-returns/${id}`, data);
    return response.data;
  },

  approve: async (id: number, notes?: string): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.patch(`/customer-returns/${id}/approve`, { notes });
    return response.data;
  },

  reject: async (id: number, reason: string): Promise<{ message: string; data: CustomerReturnResponse }> => {
    const response = await api.patch(`/customer-returns/${id}/reject`, { rejectionReason: reason });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/customer-returns/${id}`);
    return response.data;
  },
};

export default customerReturnsApi;
