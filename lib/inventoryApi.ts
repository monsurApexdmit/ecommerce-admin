/**
 * Inventory API Service
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
    // Fetch all items by getting all pages if needed
    // Use per_page parameter (standard REST API pagination parameter)
    const perPage = params?.limit || 100; // Fetch larger batch size
    const search = params?.search;
    const warehouseId = params?.warehouse_id;

    let allItems: InventoryItem[] = [];
    let page = 1;
    let hasMore = true;
    let message = '';

    while (hasMore) {
      const response = await api.get('/inventory', {
        params: {
          page,
          per_page: perPage,  // Changed from 'limit' to 'per_page'
          ...(search && { search }),
          ...(warehouseId && { location_id: warehouseId }),
        }
      });

      // Backend returns: { success, message, data: [...items...], meta: { pagination: { total, page, per_page } } }
      message = response.data.message || '';
      const items = response.data.data || [];
      const meta = response.data.meta || {};
      const pagination = meta.pagination || {};

      allItems = [...allItems, ...items];

      const total = pagination.total || 0;
      const currentCount = allItems.length;
      hasMore = currentCount < total;
      page++;
    }

    return {
      message,
      data: allItems,
      page: 1,
      limit: allItems.length,
      total: allItems.length,
    };
  },
};

export default inventoryApi;
