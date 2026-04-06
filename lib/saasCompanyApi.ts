/**
 * SaaS Company API Service
 * Handles company profile, settings, team management, and subscription status
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

// Use Next.js proxy to bypass browser TLS issues with self-signed certs in development
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

      // Add company_id from localStorage
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
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// ============ TYPE DEFINITIONS ============

export interface CompanyProfilePayload {
  name?: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  logo?: string;
  description?: string;
}

export interface CompanyProfile {
  id: number;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  logo?: string;
  description?: string;
  status: 'trial' | 'active' | 'expired' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface GetCompanyResponse {
  message: string;
  data: CompanyProfile;
}

export interface UpdateCompanyPayload {
  companyProfile: CompanyProfilePayload;
}

export interface UpdateCompanyResponse {
  message: string;
  data: CompanyProfile;
}

export interface BillingContactPayload {
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId?: string;
  taxIdType?: 'vat' | 'ein' | 'gst' | 'other';
}

export interface BillingContact {
  id: number;
  companyId: number;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId?: string;
  taxIdType?: 'vat' | 'ein' | 'gst' | 'other';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetBillingContactResponse {
  message: string;
  data: BillingContact;
}

export interface UpdateBillingContactResponse {
  message: string;
  data: BillingContact;
}

export interface CompanyUser {
  id: number;
  companyId?: number;
  email: string;
  fullName: string;
  role?: string;
  roleId?: number;
  staffRole?: {
    id: number;
    companyId?: number;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  status: 'active' | 'invited' | 'inactive';
  joinedDate: string;
  lastLogin?: string;
  avatar?: string;
}

export interface GetTeamUsersResponse {
  message: string;
  data: {
    users: CompanyUser[];
    totalUsers: number;
    maxUsers: number;
    canAddMore: boolean;
  };
}

export interface InviteUserPayload {
  email: string;
  fullName: string;
  roleId: number;
}

export interface InviteUserResponse {
  message: string;
  data: {
    userId: number;
    email: string;
    status: 'invited';
    invitationToken: string;
    expiresAt: string;
    invitedAt: string;
  };
}

export interface UpdateUserRolePayload {
  role: 'admin' | 'manager' | 'staff';
}

export interface UpdateUserRoleResponse {
  message: string;
  data: {
    userId: number;
    role: 'admin' | 'manager' | 'staff';
    updatedAt: string;
  };
}

export interface RemoveUserResponse {
  message: string;
  data: {
    userId: number;
    success: boolean;
    removedAt: string;
  };
}

export interface CompanyStatus {
  id: number;
  name: string;
  status: 'trial' | 'active' | 'expired' | 'suspended';
  licenseKey: string;
  licenseType: 'trial' | 'paid';
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  subscriptionId?: number;
  subscriptionPlanId?: number;
  subscriptionPlanName?: string;
  subscriptionEndDate?: string;
  userCount: number;
  maxUsers: number;
  createdAt: string;
}

export interface GetCompanyStatusResponse {
  message: string;
  data: CompanyStatus;
}

export interface DeleteCompanyPayload {
  confirmPassword: string;
  reason?: string;
}

export interface DeleteCompanyResponse {
  message: string;
  data: {
    companyId: number;
    success: boolean;
    deletedAt: string;
    dataRetentionDays: number;
  };
}

export interface CompanySettingsPayload {
  companyName?: string;
  taxId?: string;
  taxIdType?: 'vat' | 'ein' | 'gst' | 'other';
  taxRate?: number;
  currency?: string;
  timezone?: string;
  language?: string;
}

export interface CompanySettings {
  id: number;
  companyId: number;
  companyName: string;
  taxId?: string;
  taxIdType?: string;
  taxRate: number;
  currency: string;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetCompanySettingsResponse {
  message: string;
  data: CompanySettings;
}

export interface UpdateCompanySettingsResponse {
  message: string;
  data: CompanySettings;
}

// ============ API METHODS ============

export const saasCompanyApi = {
  /**
   * GET /auth/company/profile
   * Get company profile
   */
  getProfile: async () => {
    const response = await api.get<GetCompanyResponse>('/auth/company/profile');
    return response.data;
  },

  /**
   * PUT /auth/company/profile
   * Update company profile
   */
  updateProfile: async (payload: UpdateCompanyPayload) => {
    const response = await api.put<UpdateCompanyResponse>('/auth/company/profile', payload);
    return response.data;
  },

  /**
   * GET /billing/contact
   * Get billing contact information
   */
  getBillingContact: async () => {
    const response = await api.get<GetBillingContactResponse>('/billing/contact');
    return response.data;
  },

  /**
   * PUT /billing/contact
   * Update billing contact information
   */
  updateBillingContact: async (payload: BillingContactPayload) => {
    const response = await api.put<UpdateBillingContactResponse>(
      '/billing/contact',
      payload
    );
    return response.data;
  },

  /**
   * GET /auth/company/status
   * Get company subscription and license status
   */
  getStatus: async () => {
    const response = await api.get<GetCompanyStatusResponse>('/auth/company/status');
    return response.data;
  },

  /**
   * GET /auth/company/settings
   * Get company settings (tax, currency, timezone, language)
   */
  getSettings: async () => {
    const response = await api.get<GetCompanySettingsResponse>('/auth/company/settings');
    return response.data;
  },

  /**
   * PUT /auth/company/settings
   * Update company settings
   */
  updateSettings: async (payload: CompanySettingsPayload) => {
    const response = await api.put<UpdateCompanySettingsResponse>('/auth/company/settings', payload);
    return response.data;
  },

  /**
   * DELETE /auth/company
   * Delete entire company and data
   */
  deleteCompany: async (payload: DeleteCompanyPayload) => {
    const response = await api.delete<DeleteCompanyResponse>('/auth/company', { data: payload });
    return response.data;
  },

  // ============ TEAM MANAGEMENT ============

  /**
   * GET /auth/team
   * Get all team members
   */
  getTeamUsers: async () => {
    const response = await api.get<GetTeamUsersResponse>('/auth/team');
    return response.data;
  },

  /**
   * POST /auth/team/invite
   * Invite new team member
   */
  inviteUser: async (payload: InviteUserPayload) => {
    const response = await api.post<InviteUserResponse>('/auth/team/invite', payload);
    return response.data;
  },

  /**
   * PUT /auth/team/:userId/role
   * Update user role
   */
  updateUserRole: async (userId: number, payload: UpdateUserRolePayload) => {
    const response = await api.put<UpdateUserRoleResponse>(
      `/auth/team/${userId}/role`,
      payload
    );
    return response.data;
  },

  /**
   * DELETE /auth/team/:userId
   * Remove team member
   */
  removeUser: async (userId: number) => {
    const response = await api.delete<RemoveUserResponse>(`/auth/team/${userId}`);
    return response.data;
  },

  /**
   * GET /auth/team/:userId
   * Get user details (assumes backend supports this)
   */
  getUser: async (userId: number) => {
    const response = await api.get<{ message: string; data: CompanyUser }>(
      `/auth/team/${userId}`
    );
    return response.data;
  },

  /**
   * POST /auth/team/:userId/resend-invitation
   * Resend invitation email
   */
  resendInvitation: async (userId: number) => {
    const response = await api.post(`/auth/team/${userId}/resend-invitation`);
    return response.data;
  },

  /**
   * POST /auth/team/invite/accept
   * Accept team invitation with token
   */
  acceptInvitation: async (token: string) => {
    const response = await api.post('/auth/team/invite/accept', { token });
    return response.data;
  },
};

export default saasCompanyApi;
