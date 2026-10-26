/**
 * Sells API Service
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

export interface SellItem {
  id?: number;
  sellId?: number;
  productId?: number;
  variantId?: number;
  variant_id?: number;
  inventoryId?: number;
  inventory_id?: number;
  productName: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  unitPrice?: number;
  total_price?: number;
  totalPrice?: number;
  discount?: number;
  createdAt?: string;
  updatedAt?: string;
  bundleItems?: { productId: number; productName: string; qtyPerBundle: number; totalQty: number }[] | null;
}

export interface SellShipment {
  id: number;
  sellId: number;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status: string;
  estimatedDelivery?: string;
  courier?: string | null;
  zone?: string | null;
  codAmount?: number | null;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellShippingAddress {
  id: number;
  customerId: number;
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault: boolean;
  addressType: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellResponse {
  id: number;
  invoiceNo: string;
  invoice_no?: string;
  orderTime: string;
  customerId?: number;
  customerName: string;
  shippingAddressId?: number;
  shippingAddress?: SellShippingAddress;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingEmail?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingAddressType?: string;
  method: string;
  amount: number;
  discount?: number;
  couponId?: number;
  couponCode?: string;
  shippingCost?: number;
  status: 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';
  paymentStatus?: string;
  paidAmount?: number;
  dueAmount?: number;
  shippingMethodName?: string;
  source?: 'pos' | 'storefront' | 'manual' | null;
  paymentTransactionId?: string | null;
  transactionId?: string | null;
  zoneName?: string | null;
  courier?: string | null;
  deliveryNote?: string | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  locationId?: number | null;
  locationName?: string | null;
  shippingDepositAmount?: number | null;
  shippingDepositTransactionId?: string | null;
  fulfillmentStatus?: string;
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: string;
  notes?: string;
  items?: SellItem[];
  shipments?: SellShipment[];
  createdAt: string;
  updatedAt: string;
}

export type SellTab = 'all' | 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
export type SellTabCounts = Record<SellTab, number>;
export interface SellKpis {
  totalOrders: number; last30Days: number; pending: number; confirmedOrPacked: number;
  shipped: number; delivered: number; revenue: number; dueToCollect: number; unpaidCount: number;
}

export interface SellListResponse {
  message: string;
  data: SellResponse[];
  total?: number;
  page?: number;
  limit?: number;
  /** Count and revenue total of every sale matching the filters (not just this page) */
  summary?: { count: number; total: number };
  /** Raw `meta` from the list endpoint: per-tab counts and KPI stats (see PHASE2_API_CONTRACT.md) */
  meta?: Record<string, any>;
}

export interface SellStatsResponse {
  message: string;
  data: {
    totalSells: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    gpMarginPercent: number;
    pendingOrders: number;
    processingOrders: number;
    deliveredOrders: number;
    packedOrders?: number;
    totalDue?: number;
    unpaidCount?: number;
    shippedOrders?: number;
    cancelledOrders?: number;
  };
}

export interface CreateSellData {
  customerId?: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddressId?: number;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingEmail?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  method: string;
  source?: 'pos' | 'storefront' | 'manual';
  /** Warehouse / branch the sale was made from */
  locationId?: number;
  /** Open register shift this sale belongs to */
  registerSessionId?: number;
  paymentTransactionId?: string;
  transactionId?: string;
  zoneName?: string;
  deliveryNote?: string;
  /** Tax is stored as sent; amount already includes it */
  taxRate?: number;
  taxAmount?: number;
  amount: number;
  discount?: number;
  /** Discount excluding the coupon's; the backend recomputes the coupon part */
  manualDiscount?: number;
  couponId?: number;
  couponCode?: string;
  shippingCost?: number;
  shippingMethod?: string;
  status?: 'Pending' | 'Processing' | 'Packed' | 'Shipped' | 'Delivered';
  /** Courier for delivered orders; the backend creates a linked shipment */
  courier?: string;
  note?: string;
  notes?: string;
  /** Amount received now. When sent, the sale starts with a recorded payment and a paid/due balance. */
  paidAmount?: number;
  items: {
    productId: number;
    variantId?: number;
    variant_id?: number;
    inventoryId?: number;
    inventory_id?: number;
    productName: string;
    quantity: number;
    price: number;
    unitPrice?: number;
    unit_price?: number;
    /** Per-line discount amount */
    discount?: number;
  }[];
}

export interface UpdateSellData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  method?: string;
  amount?: number;
  discount?: number;
  shippingCost?: number;
  status?: 'Pending' | 'Processing' | 'Delivered';
  notes?: string;
  note?: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
}

/** Editable delivery details of an order (receiver, phone, address, note). */
export interface UpdateDeliveryDetailsData {
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  notes?: string;
  deliveryNote?: string;
  zoneName?: string;
  courier?: string;
  transactionId?: string;
}

export const sellsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    per_page?: number;
    search?: string;
    status?: string;
    method?: string;
    source?: string;
    payment?: string;
    fulfillment?: string;
    customer_id?: number;
    customer?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<SellListResponse> => {
    const response = await api.get('/sells', { params });
    // Backend returns either:
    // 1. { success, message, data: [sells array] } - direct array
    // 2. { success, message, data: { data: [...], pagination } } - paginated format
    const data = response.data.data || [];
    const isArray = Array.isArray(data);
    const sellsData = isArray ? data : (data.data || []);
    const paginationData = isArray ? (response.data.meta?.pagination ? { total: response.data.meta.pagination.total, current_page: response.data.meta.pagination.page, per_page: response.data.meta.pagination.per_page } : {}) : data;

    return {
      message: response.data.message || '',
      data: sellsData,
      total: paginationData.total || sellsData.length || 0,
      page: paginationData.current_page || 1,
      limit: paginationData.per_page || 10,
      summary: response.data.meta?.summary,
      meta: response.data.meta,
    };
  },

  getStats: async (params?: { source?: string }): Promise<SellStatsResponse> => {
    const response = await api.get('/sells/stats', { params });
    return response.data;
  },

  getWeeklyOrders: async (): Promise<{ data: number[] }> => {
    const response = await api.get('/sells/weekly-orders');
    return response.data;
  },

  getMonthlyRevenue: async (): Promise<{ data: number[] }> => {
    const response = await api.get('/sells/monthly-revenue');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.get(`/sells/${id}`);
    return response.data;
  },

  getByInvoice: async (invoiceNo: string): Promise<{ message: string; data: SellResponse }> => {
    // Remove leading # if present (in case user copies invoice number with # prefix)
    const cleanInvoiceNo = invoiceNo.startsWith('#') ? invoiceNo.substring(1) : invoiceNo;
    const response = await api.get(`/sells/invoice/${encodeURIComponent(cleanInvoiceNo)}`);
    return response.data;
  },

  create: async (data: CreateSellData): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.post('/sells', data);
    return response.data;
  },

  update: async (id: number, data: UpdateSellData): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.put(`/sells/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: number, status: SellResponse['status'], reason?: string): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.patch(`/sells/${id}/status`, reason ? { status, reason } : { status });
    return response.data;
  },

  /** Mark an open order packed or shipped (shipped links/creates a shipment), or put it back to unfulfilled. */
  updateFulfillment: async (id: number, fulfillment: 'packed' | 'shipped' | 'unfulfilled'): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.patch(`/sells/${id}/fulfillment`, { fulfillment });
    return response.data;
  },

  /** Edit receiver, phone, address and note (PATCH /sells/{id}/delivery; 422 when Cancelled/Delivered). */
  updateDeliveryDetails: async (id: number, data: UpdateDeliveryDetailsData): Promise<{ message: string; data: SellResponse }> => {
    const { notes, ...rest } = data;
    const response = await api.patch(`/sells/${id}/delivery`, { ...rest, note: notes ?? '' });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/sells/${id}`);
    return response.data;
  },
};

export default sellsApi;
