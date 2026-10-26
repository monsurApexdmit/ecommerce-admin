import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
  }
  return config;
}, (error) => Promise.reject(error));

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

export type AddressType = 'home' | 'office' | 'other';

export interface ShippingAddressResponse {
  id: number;
  companyId: number;
  customerId: number | null;
  customerName: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isDefault: boolean;
  addressType: AddressType | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddressPayload {
  customerId: number | null;
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  addressType: AddressType;
}

export const shippingAddressApi = {
  getAll: async (params?: { search?: string; address_type?: string; customer_id?: number }): Promise<ShippingAddressResponse[]> => {
    const res = await api.get('/shipping-addresses', { params });
    const data = res.data?.data;
    return Array.isArray(data) ? data : (data?.data ?? []);
  },
  create: async (data: ShippingAddressPayload): Promise<ShippingAddressResponse> => {
    const res = await api.post('/shipping-addresses', data);
    return res.data.data;
  },
  update: async (id: number, data: Partial<ShippingAddressPayload>): Promise<ShippingAddressResponse> => {
    const res = await api.put(`/shipping-addresses/${id}`, data);
    return res.data.data;
  },
  setDefault: async (id: number): Promise<ShippingAddressResponse> => {
    const res = await api.patch(`/shipping-addresses/${id}/set-default`);
    return res.data.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/shipping-addresses/${id}`);
  },
};

export default shippingAddressApi;
