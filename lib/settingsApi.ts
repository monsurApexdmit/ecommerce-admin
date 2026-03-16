/**
 * Settings API Service
 * Handles all store settings: general, tax, shipping, payment, business, etc.
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

// Type Definitions

export interface GeneralSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  storeDescription: string;
}

export interface TaxSettings {
  id?: number;
  defaultTaxRate: number;          // e.g., 10 for 10%
  taxInclusivePrice: boolean;       // Include tax in displayed price?
  enableGSTTracking: boolean;
  gstNumber?: string;
  enableTaxExemption: boolean;
  defaultShippingTax: number;
}

export interface ShippingMethod {
  id: string;
  name: string;
  cost: number;
  estimatedDays: number;
  isActive: boolean;
}

export interface ShippingSettings {
  id?: number;
  enableShipping: boolean;
  defaultShippingCost: number;
  freeShippingThreshold?: number;
  shippingMethods: ShippingMethod[];
}

export interface PaymentSettings {
  id?: number;
  enableCash: boolean;
  enableCard: boolean;
  enableOnline: boolean;
  stripeKey?: string;
  razorpayKey?: string;
  cardProcessingFee: number;
}

export interface BusinessSettings {
  id?: number;
  businessName: string;
  businessType: string;
  registrationNumber?: string;
  gstNumber: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface StoreHours {
  [key: string]: {
    open: string;
    close: string;
    isOpen: boolean;
  };
}

export interface RegionalSettings {
  language: string;
  currency: string;
  timezone: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  orderNotifications: boolean;
  marketingEmails: boolean;
}

export interface AllSettings {
  id?: number;
  general: GeneralSettings;
  tax: TaxSettings;
  shipping: ShippingSettings;
  payment: PaymentSettings;
  business: BusinessSettings;
  regional: RegionalSettings;
  notifications: NotificationSettings;
  storeHours: StoreHours;
  createdAt?: string;
  updatedAt?: string;
}

// API Methods

export const settingsApi = {
  // Get all settings
  getAll: async (): Promise<{ message: string; data: AllSettings }> => {
    const response = await api.get('/settings');
    return response.data;
  },

  // Get specific setting sections
  getGeneral: async (): Promise<{ message: string; data: GeneralSettings }> => {
    const response = await api.get('/settings/general');
    return response.data;
  },

  getTax: async (): Promise<{ message: string; data: TaxSettings }> => {
    const response = await api.get('/settings/tax');
    return response.data;
  },

  getShipping: async (): Promise<{ message: string; data: ShippingSettings }> => {
    const response = await api.get('/settings/shipping');
    return response.data;
  },

  getPayment: async (): Promise<{ message: string; data: PaymentSettings }> => {
    const response = await api.get('/settings/payment');
    return response.data;
  },

  getBusiness: async (): Promise<{ message: string; data: BusinessSettings }> => {
    const response = await api.get('/settings/business');
    return response.data;
  },

  getRegional: async (): Promise<{ message: string; data: RegionalSettings }> => {
    const response = await api.get('/settings/regional');
    return response.data;
  },

  getNotifications: async (): Promise<{ message: string; data: NotificationSettings }> => {
    const response = await api.get('/settings/notifications');
    return response.data;
  },

  getStoreHours: async (): Promise<{ message: string; data: StoreHours }> => {
    const response = await api.get('/settings/store-hours');
    return response.data;
  },

  // Update specific sections
  updateGeneral: async (data: GeneralSettings): Promise<{ message: string; data: GeneralSettings }> => {
    const response = await api.put('/settings/general', data);
    return response.data;
  },

  updateTax: async (data: Partial<TaxSettings>): Promise<{ message: string; data: TaxSettings }> => {
    const response = await api.patch('/settings/tax', data);
    return response.data;
  },

  updateShipping: async (data: Partial<ShippingSettings>): Promise<{ message: string; data: ShippingSettings }> => {
    const response = await api.patch('/settings/shipping', data);
    return response.data;
  },

  updatePayment: async (data: Partial<PaymentSettings>): Promise<{ message: string; data: PaymentSettings }> => {
    const response = await api.patch('/settings/payment', data);
    return response.data;
  },

  updateBusiness: async (data: Partial<BusinessSettings>): Promise<{ message: string; data: BusinessSettings }> => {
    const response = await api.patch('/settings/business', data);
    return response.data;
  },

  updateRegional: async (data: Partial<RegionalSettings>): Promise<{ message: string; data: RegionalSettings }> => {
    const response = await api.patch('/settings/regional', data);
    return response.data;
  },

  updateNotifications: async (data: Partial<NotificationSettings>): Promise<{ message: string; data: NotificationSettings }> => {
    const response = await api.patch('/settings/notifications', data);
    return response.data;
  },

  updateStoreHours: async (data: StoreHours): Promise<{ message: string; data: StoreHours }> => {
    const response = await api.patch('/settings/store-hours', data);
    return response.data;
  },

  // Security & Files
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> => {
    const response = await api.post('/settings/change-password', data);
    return response.data;
  },

  uploadLogo: async (file: File): Promise<{ message: string; data: { logoUrl: string } }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/settings/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadBanner: async (file: File): Promise<{ message: string; data: { bannerUrl: string } }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/settings/upload-banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default settingsApi;
