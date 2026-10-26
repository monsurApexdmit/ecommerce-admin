/**
 * Customer API Service
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

export interface CustomerAddress {
  id: number;
  customerId: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  addressType: string;
  isDefault: boolean;
}

export type CustomerGroup = 'retail' | 'wholesale' | 'vip';
export type CustomerKind = 'individual' | 'business';

export interface CustomerCounts {
  total: number;
  active: number;
  inactive: number;
  byGroup: { retail: number; wholesale: number; vip: number };
  byType: { individual: number; business: number };
}

export interface CustomerExtraFields {
  type?: CustomerKind;
  businessName?: string;
  licenceBin?: string;
  customerGroup?: CustomerGroup;
  creditLimit?: number;
  openingBalance?: number;
  birthday?: string | null;
  tags?: string[];
  smsOptIn?: boolean;
  district?: string;
  area?: string;
}

export interface DuplicateGroup {
  key: string;
  reason: 'phone' | 'name_email';
  customers: CustomerResponse[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  skippedRows: { row: number; reason: string }[];
}

export interface CustomerResponse {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  customerType: CustomerGroup;
  customerGroup?: CustomerGroup;
  type?: CustomerKind;
  businessName?: string | null;
  licenceBin?: string | null;
  creditLimit?: number;
  openingBalance?: number;
  /** Outstanding due on sales */
  creditUsed?: number;
  creditUsedPercent?: number;
  birthday?: string | null;
  tags?: string[];
  smsOptIn?: boolean;
  district?: string | null;
  area?: string | null;
  recentOrders?: { id: number; invoiceNo: string; date: string; amount: number; status: string }[];
  status: 'active' | 'inactive';
  notes: string;
  storeCredit: number;
  totalOrders?: number;
  totalSpent?: number;
  /** Outstanding balance across the customer's sales */
  dueAmount?: number;
  lastOrderAt?: string | null;
  /** Another customer has the same phone number */
  duplicatePhone?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  message: string;
  counts?: CustomerCounts;
  data: CustomerResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerData extends CustomerExtraFields {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  customerType?: CustomerGroup;
  status?: 'active' | 'inactive';
  notes?: string;
  storeCredit?: number;
}

export interface UpdateCustomerData extends CustomerExtraFields {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  customerType?: CustomerGroup;
  status?: 'active' | 'inactive';
  notes?: string;
  storeCredit?: number;
}

export interface CustomerListParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    /** individual | business */
    type?: string;
    /** retail | wholesale | vip */
    group?: string;
    smsOptIn?: boolean;
    /** all | loyal | risk | due | never | dup */
    segment?: string;
    /** recent | name | spent | orders | due */
    sort?: string;
}

export const customerApi = {
  getAll: async (params?: CustomerListParams): Promise<CustomerListResponse> => {
    const response = await api.get('/customers', { params });
    // Laravel returns { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      counts: laravelData.counts,
      total: laravelData.total || 0,
      page: laravelData.current_page || 1,
      limit: laravelData.per_page || 10,
    };
  },

  getById: async (id: number): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  create: async (data: CreateCustomerData): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  update: async (id: number, data: UpdateCustomerData): Promise<{ message: string; data: CustomerResponse }> => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  getAddresses: async (customerId: number): Promise<CustomerAddress[]> => {
    const response = await api.get('/shipping-addresses', { params: { customer_id: customerId } });
    return response.data.data || [];
  },

  createAddress: async (data: {
    customerId: number;
    fullName: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    addressType?: string;
    isDefault?: boolean;
  }): Promise<CustomerAddress> => {
    const response = await api.post('/shipping-addresses', data);
    return response.data.data;
  },

  updateAddress: async (id: number, data: Partial<{
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    addressType: string;
    isDefault: boolean;
  }>): Promise<CustomerAddress> => {
    const response = await api.put(`/shipping-addresses/${id}`, data);
    return response.data.data;
  },

  deleteAddress: async (id: number): Promise<void> => {
    await api.delete(`/shipping-addresses/${id}`);
  },

  setDefaultAddress: async (id: number): Promise<CustomerAddress> => {
    const response = await api.patch(`/shipping-addresses/${id}/set-default`);
    return response.data.data;
  },

  /** Fetch every row matching the filters (used by export) */
  getAllFiltered: async (params: CustomerListParams = {}): Promise<CustomerResponse[]> => {
    const res = await customerApi.getAll({ ...params, page: 1, limit: 2000 });
    const out = [...res.data];
    const pages = Math.ceil((res.total || 0) / 2000);
    for (let p = 2; p <= pages; p++) {
      const r = await customerApi.getAll({ ...params, page: p, limit: 2000 });
      out.push(...r.data);
    }
    return out;
  },

  setStatus: async (id: number, status: 'active' | 'inactive'): Promise<CustomerResponse> => {
    const response = await api.patch(`/customers/${id}/status`, { status });
    return response.data.data;
  },

  getDuplicates: async (): Promise<DuplicateGroup[]> => {
    const response = await api.get('/customers/duplicates');
    return response.data.data?.groups ?? [];
  },

  merge: async (primaryId: number, duplicateIds: number[]): Promise<{ merged: number; customer: CustomerResponse }> => {
    const response = await api.post('/customers/merge', { primaryId, duplicateIds });
    return response.data.data;
  },

  bulkTag: async (ids: number[], tag: string): Promise<{ updated: number }> => {
    const response = await api.post('/customers/bulk-tag', { ids, tag });
    return response.data.data;
  },

  getSmsNumbers: async (params?: { search?: string; group?: string; type?: string; status?: string; segment?: string }): Promise<{ numbers: string[]; count: number }> => {
    const response = await api.get('/customers/sms-numbers', { params });
    return response.data.data ?? { numbers: [], count: 0 };
  },

  importRows: async (rows: Record<string, unknown>[]): Promise<ImportResult> => {
    const response = await api.post('/customers/import', { rows });
    return response.data.data;
  },

  getStats: async (): Promise<{
    total: number;
    active: number;
    inactive: number;
    individuals: number;
    businesses: number;
    addedThisMonth: number;
    withOrders: number;
    repeatBuyers: number;
    repeatRatePct: number;
    avgLifetimeValue: number;
    owing: number;
    totalDue: number;
    atRisk: number;
    loyal: number;
    never: number;
    duplicates: number;
  }> => {
    const response = await api.get('/customers/stats');
    return response.data.data;
  },
};

export default customerApi;
