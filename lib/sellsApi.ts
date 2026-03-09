/**
 * Sells API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';

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
  createdAt?: string;
  updatedAt?: string;
}

export interface SellShipment {
  id: number;
  sellId: number;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status: string;
  estimatedDelivery?: string;
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
  shippingCost?: number;
  discount?: number;
  status: 'Pending' | 'Processing' | 'Delivered';
  paymentStatus?: string;
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

export interface SellListResponse {
  message: string;
  data: SellResponse[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface SellStatsResponse {
  message: string;
  data: {
    total_sells: number;
    total_revenue: number;
    pending_count: number;
    processing_count: number;
    delivered_count: number;
  };
}

export interface CreateSellData {
  customerId?: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddressId?: number;
  method: string;
  amount: number;
  discount?: number;
  shippingCost?: number;
  status?: 'Pending' | 'Processing' | 'Delivered';
  note?: string;
  items: {
    productId: number;
    variantId?: number;
    variant_id?: number;
    inventoryId?: number;
    inventory_id?: number;
    productName: string;
    quantity: number;
    price: number;
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
}

export const sellsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    method?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<SellListResponse> => {
    const response = await api.get('/sells', { params });
    return response.data;
  },

  getStats: async (): Promise<SellStatsResponse> => {
    const response = await api.get('/sells/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.get(`/sells/${id}`);
    return response.data;
  },

  getByInvoice: async (invoiceNo: string): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.get(`/sells/invoice/${encodeURIComponent(invoiceNo)}`);
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

  updateStatus: async (id: number, status: SellResponse['status']): Promise<{ message: string; data: SellResponse }> => {
    const response = await api.patch(`/sells/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/sells/${id}`);
    return response.data;
  },
};

export default sellsApi;
