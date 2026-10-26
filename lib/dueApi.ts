/**
 * Customer Due API Service
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

export type AgingBucket = 'current' | '30' | '60' | '90+';

export interface CustomerDueResponse {
  customerId: number;
  customerName: string;
  totalDue: number;
  oldestUnpaidDate: string;
  agingBucket: AgingBucket;
  sellCount: number;
}

export interface DueSummary {
  totalDue: number;
  totalOverdue: number;
  count: number;
}

export interface CustomerDueListResponse {
  message: string;
  data: CustomerDueResponse[];
  summary?: DueSummary;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface VendorDueResponse {
  vendorId: number;
  vendorName: string;
  poNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  agingBucket: AgingBucket;
  daysOld: number;
}

export interface VendorDueListResponse {
  message: string;
  data: VendorDueResponse[];
  summary?: DueSummary;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export type DueParty = 'customers' | 'vendors';

export interface DuePartyRow {
  partyId: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  docs: number;
  due: number;
  oldestDate: string | null;
  ageDays: number;
  lastPaymentDate: string | null;
  paidSoFar: number;
  hasPartial: boolean;
  lastDocNos: string[];
  walkIn?: boolean;
  // customers
  group?: string | null;
  lastReminder?: { channel: string | null; at: string | null } | null;
  // suppliers
  dueDate?: string | null;
  dueInDays?: number | null;
  overdue?: boolean;
  statuses?: string[];
}

export interface DueAgingBucket { key: 0 | 1 | 2 | 3; label: string; amount: number; count: number }

export interface DueSummaryData {
  rows: DuePartyRow[];
  aging: DueAgingBucket[];
  stats: Record<string, number>;
  total?: number;
}

export interface DueDocument {
  documentType: 'sell' | 'purchase_order' | 'opening_balance';
  documentId: number | null;
  no: string;
  date: string;
  ageDays: number;
  total: number;
  paid: number;
  due: number;
  status?: string | null;
  dueDate?: string | null;
}

export interface DueHistoryItem {
  id: number | string;
  partyName: string;
  reference: string | null;
  notes: string | null;
  date: string;
  method: string;
  amount: number;
  documentNo?: string | null;
}

export const dueApi = {
  getSummary: async (party: DueParty, params?: { search?: string; payment?: string; bucket?: number; sort?: 'age' | 'amount' | 'name'; page?: number; per_page?: number }): Promise<DueSummaryData> => {
    const response = await api.get(`/dues/${party}/summary`, { params: { per_page: 500, ...params } });
    const d = response.data.data ?? {};
    return { rows: d.rows ?? [], aging: d.aging ?? [], stats: d.stats ?? {}, total: response.data.meta?.total ?? d.total };
  },

  getDocuments: async (party: DueParty, id: number): Promise<{ party: { id: number; name: string; phone?: string | null }; documents: DueDocument[] }> => {
    const response = await api.get(`/dues/${party}/${id}/documents`);
    const d = response.data.data ?? {};
    return { party: d.party ?? { id, name: '' }, documents: d.documents ?? d.docs ?? [] };
  },

  settle: async (party: DueParty, id: number, body: {
    amount: number; method: string; date?: string; reference?: string; notes?: string; documentIds?: { type: string; id: number | null }[];
  }): Promise<{ allocations: { documentType: string; documentId: number | null; no: string; amount: number }[] }> => {
    const response = await api.post(party === 'customers' ? `/dues/customers/${id}/collect` : `/dues/vendors/${id}/pay`, body);
    return response.data.data ?? { allocations: [] };
  },

  getHistory: async (direction: 'in' | 'out', limit = 15): Promise<DueHistoryItem[]> => {
    const response = await api.get('/dues/history', { params: { direction, limit } });
    return response.data.data ?? [];
  },

  /** preview=true only builds the message; nothing is logged. Otherwise the reminder event is recorded (nothing is sent). */
  remind: async (id: number, channel: 'SMS' | 'WhatsApp' | 'Copy', preview = false): Promise<{ message: string; lastReminder?: { channel: string | null; at: string | null } | null }> => {
    const response = await api.post(`/dues/customers/${id}/remind`, { channel, preview });
    return response.data.data ?? { message: '' };
  },

  /**
   * Get customers who owe money (paginated)
   */
  getCustomerDues: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    aging?: string;
  }): Promise<CustomerDueListResponse> => {
    const response = await api.get('/dues/customers', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page }, summary }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      summary: response.data.summary || undefined,
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
   * Get vendors who are owed money on purchase orders (paginated)
   */
  getVendorDues: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    aging?: string;
  }): Promise<VendorDueListResponse> => {
    const response = await api.get('/dues/vendors', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page }, summary }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      summary: response.data.summary || undefined,
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
};

export default dueApi;
