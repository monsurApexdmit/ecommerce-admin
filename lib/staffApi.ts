/**
 * Staff API Service
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

export interface StaffResponse {
  id: number;
  userId: number;
  name: string;
  email: string;
  contact: string;
  joiningDate: string;
  role: string;
  status: 'Active' | 'Inactive';
  published: boolean;
  avatar: string;
  salary: number;
  bankAccount?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListResponse {
  message: string;
  data: StaffResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateStaffData {
  name: string;
  email: string;
  contact: string;
  joiningDate?: string;
  role?: string;
  status?: 'Active' | 'Inactive';
  published?: boolean;
  avatar?: string;
  salary?: number;
  bankAccount?: string;
  paymentMethod?: string;
}

export interface UpdateStaffData {
  name?: string;
  email?: string;
  contact?: string;
  joiningDate?: string;
  role?: string;
  status?: 'Active' | 'Inactive';
  published?: boolean;
  avatar?: string;
  salary?: number;
  bankAccount?: string;
  paymentMethod?: string;
}

export interface SalaryPaymentResponse {
  id: number;
  staffId: number;
  staff?: StaffResponse;
  month: string;
  amount: number;
  paidAmount: number;
  status: 'Paid' | 'Pending' | 'Partial';
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPaymentListResponse {
  message: string;
  data: SalaryPaymentResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSalaryPaymentData {
  staffId: number;
  month: string;
  amount: number;
  paidAmount: number;
  status: 'Paid' | 'Pending' | 'Partial';
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface UpdateSalaryPaymentData {
  staffId: number;
  month: string;
  amount: number;
  paidAmount: number;
  status: 'Paid' | 'Pending' | 'Partial';
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export const staffApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<StaffListResponse> => {
    const response = await api.get('/staff', { params });
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: StaffResponse }> => {
    const response = await api.get(`/staff/${id}`);
    return response.data;
  },

  create: async (data: CreateStaffData): Promise<{ message: string; data: StaffResponse }> => {
    const response = await api.post('/staff', data);
    return response.data;
  },

  update: async (id: number, data: UpdateStaffData): Promise<{ message: string; data: StaffResponse }> => {
    const response = await api.put(`/staff/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/staff/${id}`);
    return response.data;
  },
};

export interface StaffRoleResponse {
  id: number;
  name: string;
  permissions: {
    name: string;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffRoleListResponse {
  message: string;
  data: StaffRoleResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateStaffRoleData {
  name: string;
  permissions: {
    name: string;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
}

export interface UpdateStaffRoleData {
  name: string;
  permissions: {
    name: string;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
}

export const staffRoleApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }): Promise<StaffRoleListResponse> => {
    const response = await api.get('/staff-roles', { params });
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: StaffRoleResponse }> => {
    const response = await api.get(`/staff-roles/${id}`);
    return response.data;
  },

  create: async (data: CreateStaffRoleData): Promise<{ message: string; data: StaffRoleResponse }> => {
    const response = await api.post('/staff-roles', data);
    return response.data;
  },

  update: async (id: number, data: UpdateStaffRoleData): Promise<{ message: string; data: StaffRoleResponse }> => {
    const response = await api.put(`/staff-roles/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/staff-roles/${id}`);
    return response.data;
  },
};

export const salaryPaymentApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    staffId?: number;
    month?: string;
  }): Promise<SalaryPaymentListResponse> => {
    const response = await api.get('/salary-payments', { params });
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: SalaryPaymentResponse }> => {
    const response = await api.get(`/salary-payments/${id}`);
    return response.data;
  },

  create: async (data: CreateSalaryPaymentData): Promise<{ message: string; data: SalaryPaymentResponse }> => {
    const response = await api.post('/salary-payments', data);
    return response.data;
  },

  update: async (id: number, data: UpdateSalaryPaymentData): Promise<{ message: string; data: SalaryPaymentResponse }> => {
    const response = await api.put(`/salary-payments/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/salary-payments/${id}`);
    return response.data;
  },
};

export default staffApi;
