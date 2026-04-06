/**
 * Stock Transfer API Service
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

export interface TransferLocation {
  id: number;
  name: string;
}

export interface TransferProduct {
  id: number;
  name: string;
}

export interface TransferVariant {
  id: number;
  name: string;
}

export interface TransferResponse {
  id: number;
  productId: number;
  product: TransferProduct;
  variantId: number | null;
  variant?: TransferVariant;
  fromLocationId: number;
  fromLocation: TransferLocation;
  toLocationId: number;
  toLocation: TransferLocation;
  quantity: number;
  notes?: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface TransferListResponse {
  message: string;
  data: TransferResponse[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateTransferData {
  productId: number;
  variantId?: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  notes?: string;
}

export interface LocationVariant {
  id: number;
  product_id: number;
  name: string;
  stock: number;
  sku: string;
}

export interface LocationProductRaw {
  id: number;
  name: string;
  stock: number;
  sku: string;
  variants?: LocationVariant[];
}

export interface LocationProductsResponse {
  message: string;
  data: LocationProductRaw[];
}

// Flattened row used in the UI
export interface LocationProduct {
  type: 'variant' | 'product';
  id: number;         // variant.id or product.id
  productId: number;
  productName: string;
  variantName?: string;
  sku: string;
  stock: number;
}

export const transferApi = {
  getAll: async (): Promise<TransferListResponse> => {
    const response = await api.get('/transfers');
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      page: laravelData.current_page || 1,
      limit: laravelData.per_page || 10,
      total: laravelData.total || 0,
    };
  },

  getProductsByLocation: async (locationId: number): Promise<LocationProductsResponse> => {
    const response = await api.get(`/transfers/products-by-location/${locationId}`);
    return response.data;
  },

  create: async (data: CreateTransferData): Promise<{ message: string; data: TransferResponse }> => {
    const response = await api.post('/transfers', data);
    return response.data;
  },

  cancel: async (id: number): Promise<{ message: string; data: TransferResponse }> => {
    const response = await api.put(`/transfers/${id}/cancel`);
    return response.data;
  },
};

export default transferApi;
