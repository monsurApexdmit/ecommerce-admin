/**
 * SaaS Authentication API Service
 * Handles signup, login, company management, and trial/subscription
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
      localStorage.removeItem('company_id');
      localStorage.removeItem('user_role');
      localStorage.removeItem('trial_days');
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// ============ TYPE DEFINITIONS ============

export interface SignupPayload {
  companyName: string;
  ownerFullName: string;
  email: string;
  password: string;
  phone: string;
  businessType?: string;
  website?: string;
  country?: string;
}

export interface SignupResponse {
  message: string;
  data: {
    companyId: number;
    companyName: string;
    userId: number;
    userEmail: string;
    userRole: 'owner';
    token: string;
    trialStartDate: string;
    trialEndDate: string;
    trialDaysRemaining: number;
    licenseKey: string;
    licenseType: 'trial';
    companyStatus: 'trial';
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  data: {
    userId: number;
    userEmail: string;
    companyId: number;
    companyName: string;
    companyStatus: 'trial' | 'active' | 'expired' | 'suspended';
    userRole: 'owner' | 'admin' | 'manager' | 'staff';
    token: string;
    licenseKey: string;
    licenseType: 'trial' | 'paid';
    trialDaysRemaining?: number;
    subscriptionEndDate?: string;
  };
}

export interface Company {
  id: number;
  name: string;
  status: 'trial' | 'active' | 'expired' | 'suspended';
  trialStartDate: string;
  trialEndDate: string;
  trialDaysRemaining: number;
  licenseKey: string;
  licenseType: 'trial' | 'paid';
  subscriptionId?: number;
  subscriptionPlanId?: number;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  companyId: number;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  status: 'active' | 'invited' | 'inactive';
  joinedDate: string;
  lastLogin?: string;
}

export interface CurrentUserResponse {
  message: string;
  data: {
    user: User;
    company: Company;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
  data: {
    userId: number;
    success: boolean;
  };
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  data: {
    resetTokenSent: boolean;
    expiresIn: number; // minutes
  };
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
  data: {
    success: boolean;
    redirectUrl: string;
  };
}

export interface LogoutResponse {
  message: string;
  data: {
    success: boolean;
  };
}

// ============ API METHODS ============

export const saasAuthApi = {
  /**
   * POST /auth/signup
   * Create new company account with automatic trial
   */
  signup: async (payload: SignupPayload) => {
    const response = await api.post<SignupResponse>('/auth/signup', payload);
    return response.data;
  },

  /**
   * POST /auth/login
   * Login with email and password
   */
  login: async (payload: LoginPayload) => {
    const response = await api.post<LoginResponse>('/auth/login', payload);
    return response.data;
  },

  /**
   * POST /auth/logout
   * Logout current user
   */
  logout: async () => {
    const response = await api.post<LogoutResponse>('/auth/logout');
    return response.data;
  },

  /**
   * GET /auth/me
   * Get current authenticated user and company
   */
  getCurrentUser: async () => {
    const response = await api.get<CurrentUserResponse>('/auth/me');
    return response.data;
  },

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  /**
   * POST /auth/forgot-password
   * Request password reset email
   */
  forgotPassword: async (payload: ForgotPasswordPayload) => {
    const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', payload);
    return response.data;
  },

  /**
   * POST /auth/reset-password
   * Reset password with token
   */
  resetPassword: async (payload: ResetPasswordPayload) => {
    const response = await api.post<ResetPasswordResponse>('/auth/reset-password', payload);
    return response.data;
  },

  /**
   * POST /auth/update-password
   * Change password (authenticated)
   */
  changePassword: async (payload: ChangePasswordPayload) => {
    const response = await api.post<ChangePasswordResponse>('/auth/update-password', payload);
    return response.data;
  },

  /**
   * GET /auth/verify-email/:token
   * Verify email with token
   */
  verifyEmail: async (token: string) => {
    const response = await api.get(`/auth/verify-email/${token}`);
    return response.data;
  },

  /**
   * POST /auth/resend-verification
   * Resend verification email
   */
  resendVerificationEmail: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
};

export default saasAuthApi;
