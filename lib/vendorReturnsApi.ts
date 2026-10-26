/**
 * Vendor Returns API Service
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

export type VendorReturnStatus = 'pending' | 'shipped' | 'received_by_vendor' | 'completed';

export interface VendorReturnItem {
  id?: number;
  vendorReturnId?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  reason: string;
}

export interface VendorReturnResponse {
  id: number;
  returnNumber?: string;
  vendorId: number;
  vendorName?: string;
  status: VendorReturnStatus;
  creditType?: string;
  totalAmount?: number;
  notes?: string;
  createdBy?: string;
  returnDate?: string;
  completedDate?: string;
  items?: VendorReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface VendorReturnStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    shipped: number;
    received_by_vendor: number;
    completed: number;
    total_credit_amount?: number;
    totalCreditAmount?: number;
  };
}

export interface VendorReturnListResponse {
  message: string;
  data: VendorReturnResponse[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
  total?: number;
}

export interface CreateVendorReturnData {
  vendorId: number;
  vendorName?: string;
  creditType?: string;
  notes?: string;
  returnDate?: string;
  totalAmount?: number;
  items: {
    productId: number;
    productName?: string;
    variantId?: number;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    reason: string;
  }[];
}


export interface ReturnAttachment { id: number; name: string; mime: string | null; size: number; url: string }

export interface SupplierReturnRow {
  id: number
  returnNumber: string
  returnDate: string | null
  createdAt: string
  vendorId: number
  supplierName: string
  purchaseOrderId: number | null
  poNumber: string | null
  itemsSummary: string
  lines: { name: string; quantity: number; unitCost: number; total: number }[]
  reason: string | null
  amount: number
  creditType: 'note' | 'refund' | 'replacement' | string
  status: 'pending' | 'shipped' | 'received' | 'credited' | string
  locationId: number | null
  locationName: string | null
  trackingNo: string | null
  shippedAt: string | null
  receivedAt: string | null
  creditedAt: string | null
  note: string | null
  attachments?: ReturnAttachment[]
}

export interface SupplierReturnStats {
  count: number
  pendingCount: number
  shippedCount: number
  creditToReceive: number
  creditReceived: number
  mostReturnedTo: { name: string; count: number } | null
  suppliers?: { id: number; name: string }[]
  pendingCreditAmount: number
}

export interface ReturnableItem {
  productId: number
  variantId: number | null
  name: string
  sku: string
  stock: number
  lastCost: number
  receivedQty: number | null
}

export interface CreateSupplierReturn {
  vendorId: number
  purchaseOrderId?: number
  locationId: number
  returnDate: string
  trackingNo?: string
  creditType: 'note' | 'refund' | 'replacement'
  note?: string
  items: { productId: number; variantId?: number | null; quantity: number; unitCost: number; reason: string }[]
}

export const vendorReturnsApi = {
  getLog: async (params?: Record<string, any>): Promise<{
    data: SupplierReturnRow[]; total: number; lastPage: number
    counts: Record<'all' | 'pending' | 'shipped' | 'received' | 'credited', number>
    stats: SupplierReturnStats
  }> => {
    const res = await api.get('/vendor-returns', { params })
    const raw = res.data.data
    const rows = Array.isArray(raw) ? raw : raw?.data ?? []
    const meta = res.data.meta ?? raw?.meta ?? {}
    return { data: rows, total: meta.total ?? rows.length, lastPage: meta.last_page ?? 1, counts: meta.counts ?? {}, stats: meta.stats ?? {} }
  },
  getReturnableItems: async (params: { location_id: number; vendor_id?: number; po_id?: number; search?: string }): Promise<ReturnableItem[]> => {
    const res = await api.get('/vendor-returns/returnable-items', { params })
    return res.data.data ?? []
  },
  createReturn: async (data: CreateSupplierReturn): Promise<SupplierReturnRow> => {
    const res = await api.post('/vendor-returns', data)
    return res.data.data
  },
  uploadPhotos: async (id: number, files: File[]): Promise<SupplierReturnRow> => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files[]', f))
    const res = await api.post(`/vendor-returns/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return res.data.data
  },
  removePhoto: async (id: number, attachmentId: number): Promise<SupplierReturnRow> => {
    const res = await api.delete(`/vendor-returns/${id}/attachments/${attachmentId}`)
    return res.data.data
  },
  advance: async (id: number, status: string): Promise<SupplierReturnRow> => {
    const res = await api.patch(`/vendor-returns/${id}/status`, { status })
    return res.data.data
  },

  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    vendorId?: number;
  }): Promise<VendorReturnListResponse> => {
    const response = await api.get('/vendor-returns', { params });
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

  getStats: async (): Promise<VendorReturnStatsResponse> => {
    const response = await api.get('/vendor-returns/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.get(`/vendor-returns/${id}`);
    return response.data;
  },

  getByVendor: async (vendorId: number): Promise<VendorReturnListResponse> => {
    const response = await api.get(`/vendor-returns/vendor/${vendorId}`);
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

  create: async (data: CreateVendorReturnData): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.post('/vendor-returns', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateVendorReturnData>): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.put(`/vendor-returns/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: number, status: VendorReturnStatus): Promise<{ message: string; data: VendorReturnResponse }> => {
    const response = await api.patch(`/vendor-returns/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/vendor-returns/${id}`);
    return response.data;
  },
};

export default vendorReturnsApi;
