/**
 * Inventory API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';

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

export interface InventoryLocation {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface InventoryItem {
  type: 'variant' | 'product';
  id: number;
  productId: number;
  productName: string;
  variantName?: string;
  sku: string;
  barcode?: string;
  stock: number;
  inventory: InventoryLocation[];
}

export interface InventoryListResponse {
  message: string;
  data: InventoryItem[];
  page: number;
  limit: number;
  total: number;
}

export const inventoryApi = {
  getAll: async (params?: {
    search?: string;
    warehouse_id?: number;
    page?: number;
    limit?: number;
  }): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },
};

export default inventoryApi;
