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
  email?: string;
  contact: string;
  phone?: string;
  account?: string;
  nid?: string;
  emergencyContact?: string;
  loginMethod?: 'email' | 'pin';
  pin?: string;
  locationIds?: number[];

  joiningDate?: string;
  role?: string;
  staffRoleId?: number | null;
  status?: 'Active' | 'Inactive' | 'Invited' | 'On leave' | string;
  published?: boolean;
  avatar?: string;
  salary?: number;
  bankAccount?: string;
  paymentMethod?: string;
  password?: string;
}

export interface UpdateStaffData {
  name?: string;
  email?: string;
  contact?: string;
  phone?: string;
  account?: string;
  nid?: string;
  emergencyContact?: string;
  loginMethod?: 'email' | 'pin';
  pin?: string;
  locationIds?: number[];

  joiningDate?: string;
  role?: string;
  staffRoleId?: number | null;
  status?: 'Active' | 'Inactive' | 'Invited' | 'On leave' | string;
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
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      total: laravelData.total || 0,
      page: laravelData.current_page || 1,
      limit: laravelData.per_page || 10,
    };
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

  getStats: async (): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> => {
    const response = await api.get('/staff/stats');
    return response.data.data;
  },
};

export interface StaffRoleResponse {
  id: number;
  companyId?: number;
  name: string;
  description?: string | null;
  locked?: boolean;
  memberCount?: number;
  sensitive?: Record<string, boolean> | null;
  permissions: {
    id?: number;
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
    permissionId: number;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
}

export interface UpdateStaffRoleData {
  name: string;
  permissions: {
    permissionId: number;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
}

export interface PermissionResponse {
  id: number;
  name: string;
  description: string;
}

export const staffRoleApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }): Promise<StaffRoleListResponse> => {
    const response = await api.get('/staff-roles', { params });
    // Laravel returns: { success, message, data: [...] }
    const items = Array.isArray(response.data.data) ? response.data.data : [];
    return {
      message: response.data.message || '',
      data: items,
      total: items.length,
      page: 1,
      limit: items.length,
    };
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

  getPermissions: async (): Promise<PermissionResponse[]> => {
    const response = await api.get('/staff-roles/permissions');
    return response.data.data || [];
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
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      total: laravelData.total || 0,
      page: laravelData.current_page || 1,
      limit: laravelData.per_page || 10,
    };
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


// ── New staff UI (overview, roles matrix, payroll) ─────────────────────────

export type StaffStatus = 'Active' | 'Invited' | 'On leave' | 'Inactive';

export interface StaffRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  roleId: number | null;
  roleName: string | null;
  locationIds: number[];
  locationNames: string[];
  salary: number;
  paymentMethod: string | null;
  account: string | null;
  nid: string | null;
  emergencyContact: string | null;
  joiningDate: string | null;
  status: StaffStatus | string;
  published: boolean;
  loginMethod: 'email' | 'pin' | string;
  hasPin: boolean;
  lastActiveAt: string | null;
  invited: boolean;
  isOwner?: boolean;
  isOnlyOwner?: boolean;
}

export interface StaffOverview {
  rows: StaffRow[];
  stats: {
    total: number; owners: number; staffCount: number; activeToday: number; activeTodayNames: string[];
    inactive: number; invited: number; firstInvitedName: string | null; monthlyPayroll: number; seatsUsed: number; seatLimit: number | null;
  };
  counts: Record<'all' | 'Active' | 'Invited' | 'On leave' | 'Inactive', number>;
  roles: { id: number; name: string; description?: string | null; isOwner?: boolean; memberCount: number }[];
  locations: { id: number; name: string }[];
}

export interface StaffSalarySummary {
  monthly: number;
  paidThisYear: number;
  dueNow: number;
  history: { id: number; month: string; label: string; detail: string; net: number; status: string; canPay: boolean }[];
}

export interface MatrixModuleGroup { group: string; modules: { name: string; summary: string }[] }
export type MatrixCell = { view: boolean; create: boolean; edit: boolean; delete: boolean };
export interface RoleMatrix {
  id: number;
  name: string;
  description: string | null;
  locked: boolean;
  memberCount: number;
  matrix: Record<string, MatrixCell>;
  sensitive: { cost: boolean; discount: boolean; refund: boolean; export: boolean; void: boolean };
}

export interface PayrollRow {
  staffId: number;
  name: string;
  role: string | null;
  joined: string | null;
  paymentId: number | null;
  base: number;
  bonus: number;
  deduction: number;
  bonusNote: string | null;
  deductionNote: string | null;
  net: number;
  method: string | null;
  status: 'pending' | 'paid' | 'not_generated';
}

export interface Payroll {
  month: string;
  label: string;
  payday: string;
  daysLeft: number;
  rows: PayrollRow[];
  stats: { baseTotal: number; netTotal: number; paid: number; paidCount: number; pendingNet: number; pendingCount: number; notGenerated: number; paidThisYear: number; peopleCount: number };
  history: { month: string; label: string; people: number; net: number; paid: number; pending: number }[];
  months: { month: string; label: string }[];
}

export const staffUiApi = {
  getOverview: async (params?: { search?: string; status?: string; role_id?: number; location_id?: number; page?: number; per_page?: number }): Promise<StaffOverview> => {
    const response = await api.get('/staff/overview', { params: { per_page: 500, ...params } });
    return response.data.data;
  },
  resendInvite: async (id: number) => (await api.post(`/staff/${id}/resend-invite`)).data,
  getSalarySummary: async (id: number): Promise<StaffSalarySummary> => (await api.get(`/staff/${id}/salary-summary`)).data.data,

  getMatrixModules: async (): Promise<MatrixModuleGroup[]> => {
    const response = await api.get('/staff-roles/matrix-modules');
    const d = response.data.data ?? [];
    return (Array.isArray(d) ? d : d.groups ?? []).map((g: any) => ({
      group: g.group,
      modules: (g.modules ?? []).map((m: any) => (typeof m === 'string' ? { name: m, summary: '' } : { name: m.name, summary: m.summary ?? '' })),
    }));
  },
  getRoleMatrix: async (id: number): Promise<RoleMatrix> => (await api.get(`/staff-roles/${id}/matrix`)).data.data,
  saveRoleMatrix: async (id: number, body: { name?: string; description?: string; matrix: Record<string, MatrixCell>; sensitive: RoleMatrix['sensitive'] }): Promise<RoleMatrix> =>
    (await api.put(`/staff-roles/${id}/matrix`, body)).data.data,
  createRole: async (body: { name: string; description?: string; matrix?: Record<string, MatrixCell>; sensitive?: RoleMatrix['sensitive'] }): Promise<RoleMatrix> =>
    (await api.post('/staff-roles/matrix', body)).data.data,
  duplicateRole: async (id: number): Promise<RoleMatrix> => (await api.post(`/staff-roles/${id}/duplicate`)).data.data,

  getPayroll: async (month: string): Promise<Payroll> => (await api.get('/salary/payroll', { params: { month } })).data.data,
  generatePayroll: async (month: string) => (await api.post('/salary/payroll/generate', { month })).data,
  adjustPayment: async (id: number, body: { bonus: number; deduction: number; method?: string; bonusNote?: string; deductionNote?: string }) =>
    (await api.patch(`/salary-payments/${id}/adjust`, body)).data,
  payPayment: async (id: number, body?: { method?: string; date?: string }) => (await api.post(`/salary-payments/${id}/pay`, body ?? {})).data,
  payAll: async (month: string) => (await api.post('/salary/payroll/pay-all', { month })).data,
  reversePayment: async (id: number) => (await api.post(`/salary-payments/${id}/reverse`)).data,
};

export default staffApi;
