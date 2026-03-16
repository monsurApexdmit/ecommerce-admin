/**
 * Product API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 * Uses multipart/form-data for create/update (backend expects form-data with file uploads)
 * Auto-injects company_id from auth context for multi-tenant support
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;

      // Add company_id to params for multi-tenant support
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

export interface ProductVariantResponse {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  sale_price: number;
  stock: number;
  attributes?: { [key: string]: string };
}

export interface ProductInventoryResponse {
  warehouse_id: number;
  quantity: number;
}

export interface ProductCategoryResponse {
  id: number;
  category_name: string;
  parent_id: number | null;
  status: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductLocationResponse {
  id: number;
  name: string;
  address: string;
  contact_person: string;
  is_default: boolean;
}

export interface ProductImageResponse {
  id: number;
  product_id: number;
  path: string;
  position: number;
  is_primary: boolean;
}

export interface ProductAttributeResponse {
  id: number;
  name: string;
  display_name: string;
  option_type: string;
  values: string; // comma-separated e.g. "red,green,blue"
  description: string;
  is_required: boolean;
  status: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductResponse {
  id: number;
  name: string;
  description: string;
  category: string | ProductCategoryResponse;
  location_id?: number;
  location?: ProductLocationResponse;
  price: number;
  sale_price: number;
  stock: number;
  status: string;
  published: boolean;
  image: string;
  images?: ProductImageResponse[];
  sku: string;
  barcode: string;
  vendor_id?: number;
  receipt_number?: string;
  attributes?: ProductAttributeResponse[];
  variants?: ProductVariantResponse[];
  inventory?: ProductInventoryResponse[];
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  message: string;
  data: ProductResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface CreateProductData {
  name: string;
  description?: string;
  category_id: number;
  location_id: number;
  price: number;
  sale_price: number;
  stock: number;
  published?: boolean;
  sku?: string;
  barcode?: string;
  vendor_id?: number;
  receipt_number?: string;
  attributes?: { id: string; name: string; value: string | string[] }[];
  variants?: {
    id?: number;
    name: string;
    sku: string;
    barcode?: string;
    price: number;
    sale_price: number;
    stock: number;
    attributes?: { [key: string]: string };
  }[];
  images?: File[];
}

export interface UpdateProductData extends Partial<CreateProductData> {}

function buildFormData(data: CreateProductData | UpdateProductData): FormData {
  const fd = new FormData();

  if (data.name !== undefined) fd.append('name', data.name);
  if (data.description !== undefined) fd.append('description', data.description);
  if (data.category_id !== undefined) fd.append('category_id', String(data.category_id));
  if (data.vendor_id !== undefined && !isNaN(data.vendor_id)) fd.append('vendor_id', String(data.vendor_id));
  if (data.location_id !== undefined) fd.append('location_id', String(data.location_id));
  if (data.price !== undefined) fd.append('price', String(data.price));
  if (data.sale_price !== undefined) fd.append('sale_price', String(data.sale_price));
  if (data.stock !== undefined) fd.append('stock', String(data.stock));
  if (data.sku !== undefined && data.sku !== '') fd.append('sku', data.sku);
  if (data.barcode !== undefined && data.barcode !== '') fd.append('barcode', data.barcode);
  if (data.published !== undefined) fd.append('published', String(data.published));
  if (data.receipt_number !== undefined && data.receipt_number !== '') fd.append('receipt_number', data.receipt_number);

  if (data.attributes !== undefined) {
    // Backend expects only an array of attribute IDs: [1, 2]
    const attrIds = data.attributes.map(a => parseInt(a.id));
    fd.append('attributes', JSON.stringify(attrIds));
  }
  if (data.variants !== undefined) {
    fd.append('variants', JSON.stringify(data.variants));
  }

  if (data.images && data.images.length > 0) {
    data.images.forEach((file, i) => fd.append(`image[${i}]`, file));
  }

  return fd;
}

export const productApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    category_id?: number;
    location_id?: number;
    vendor_id?: number;
  }): Promise<ProductListResponse> => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: ProductResponse }> => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  create: async (data: CreateProductData): Promise<{ message: string; data: ProductResponse }> => {
    const fd = buildFormData(data);
    const response = await api.post('/products/', fd);
    return response.data;
  },

  update: async (id: number, data: UpdateProductData): Promise<{ message: string; data: ProductResponse }> => {
    const fd = buildFormData(data);
    const response = await api.put(`/products/${id}`, fd);
    return response.data;
  },

  updateStatus: async (id: number, status: string): Promise<{ message: string; data: ProductResponse }> => {
    const response = await api.patch(`/products/${id}/status`, { status }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
};

export default productApi;
