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

export interface SSLCommerzConfig {
  enabled: boolean;
  store_id: string;
  store_passwd: string;
  sandbox: boolean;
}

export interface PortWalletConfig {
  enabled: boolean;
  app_key: string;
  app_secret: string;
  sandbox: boolean;
}

export interface StripeConfig {
  enabled: boolean;
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
}

export interface PayPalConfig {
  enabled: boolean;
  client_id: string;
  client_secret: string;
  sandbox: boolean;
}

export interface BkashConfig {
  enabled: boolean;
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  sandbox: boolean;
}

export interface NagadConfig {
  enabled: boolean;
  merchant_id: string;
  private_key: string;
  nagad_public_key: string;
  sandbox: boolean;
}

export interface CodShippingDepositConfig {
  enabled: boolean;
  gateway: 'sslcommerz' | 'portwallet' | 'bkash' | 'nagad' | 'stripe' | 'paypal';
  custom_amount: number; // 0 = use actual shipping cost
}

export interface PaymentSettings {
  id?: number;
  enableCash: boolean;
  enableCard: boolean;
  enableOnline: boolean;
  stripeKey?: string;
  razorpayKey?: string;
  cardProcessingFee: number;
  sslcommerz?: SSLCommerzConfig;
  portwallet?: PortWalletConfig;
  stripe?: StripeConfig;
  paypal?: PayPalConfig;
  bkash?: BkashConfig;
  nagad?: NagadConfig;
  cod_shipping_deposit?: CodShippingDepositConfig;
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
  auraShopHero?: AuraShopHeroSettings;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface AuraShopHeroSlide {
  imagePath?: string;
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  gradient: string;
  enabled: boolean;
}

export interface AuraShopHeroSettings {
  autoplayMs: number;
  slides: AuraShopHeroSlide[];
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
  currencySymbolPosition?: 'before' | 'after';
  currencyDecimalSeparator?: '.' | ',';
  currencyThousandsSeparator?: ',' | '.' | ' ' | '';
  currencyDecimalPlaces?: 0 | 1 | 2;
  weightUnit?: 'kg' | 'lb' | 'g' | 'oz';
  dimensionUnit?: 'cm' | 'in' | 'mm';
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
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

type ApiEnvelope<T> = { message?: string; data: T } | T;

const unwrapData = <T = any>(payload: ApiEnvelope<T>): T => {
  return ((payload as any)?.data ?? payload ?? {}) as T;
};

const withMessage = <T>(payload: any, data: T): { message: string; data: T } => ({
  message: payload?.message ?? 'Settings updated',
  data,
});

const normalizeBusiness = (data: any): BusinessSettings => ({
  ...data,
  logoUrl: data?.logoUrl ?? data?.logo_url ?? '',
  bannerUrl: data?.bannerUrl ?? data?.banner_url ?? '',
  auraShopHero: data?.auraShopHero ?? data?.aura_shop_hero,
  socialLinks: data?.socialLinks ?? data?.social_links,
});

const STORE_HOUR_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const normalizeStoreHours = (payload: any): StoreHours => {
  const data = unwrapData<any>(payload);
  const storeHours = data?.storeHours ?? data?.store_hours ?? data ?? {};

  return STORE_HOUR_DAYS.reduce<StoreHours>((hours, day) => {
    const dayHours = storeHours?.[day];
    if (dayHours && typeof dayHours === 'object') {
      hours[day] = {
        open: dayHours.open ?? '',
        close: dayHours.close ?? '',
        isOpen: Boolean(dayHours.isOpen),
      };
    }
    return hours;
  }, {});
};

const normalizeAllSettings = (payload: any): AllSettings => {
  const data = unwrapData<any>(payload);
  const business = {
    ...(data?.business ?? data?.business_settings ?? {}),
    logoUrl: data?.business?.logoUrl ?? data?.business_settings?.logoUrl ?? data?.logoUrl ?? data?.logo_url,
    bannerUrl: data?.business?.bannerUrl ?? data?.business_settings?.bannerUrl ?? data?.bannerUrl ?? data?.banner_url,
  };

  return {
    ...data,
    general: data?.general ?? data?.general_settings ?? {},
    tax: data?.tax ?? data?.tax_settings ?? {},
    shipping: data?.shipping ?? data?.shipping_settings ?? {},
    payment: data?.payment ?? data?.payment_settings ?? {},
    business: normalizeBusiness(business),
    regional: data?.regional ?? data?.regional_settings ?? {},
    notifications: data?.notifications ?? data?.notification_settings ?? {},
    storeHours: normalizeStoreHours(data?.storeHours ?? data?.store_hours ?? {}),
    createdAt: data?.createdAt ?? data?.created_at,
    updatedAt: data?.updatedAt ?? data?.updated_at,
  };
};

// API Methods

export const settingsApi = {
  // Get all settings
  getAll: async (): Promise<{ message: string; data: AllSettings }> => {
    const response = await api.get('/settings');
    return withMessage(response.data, normalizeAllSettings(response.data));
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
    return withMessage(response.data, normalizeStoreHours(response.data));
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
    return withMessage(response.data, normalizeBusiness(unwrapData(response.data)));
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
    return withMessage(response.data, normalizeStoreHours(response.data));
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
    const response = await api.post('/settings/upload-logo', formData);
    const data = unwrapData<any>(response.data);
    return withMessage(response.data, { logoUrl: data?.logoUrl ?? data?.logo_url ?? '' });
  },

  uploadBanner: async (file: File): Promise<{ message: string; data: { bannerUrl: string } }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/settings/upload-banner', formData);
    const data = unwrapData<any>(response.data);
    return withMessage(response.data, { bannerUrl: data?.bannerUrl ?? data?.banner_url ?? '' });
  },

  uploadStorefrontImage: async (file: File): Promise<{ message: string; data: { imagePath: string; imageUrl: string } }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/settings/upload-storefront-image', formData);
    return response.data;
  },
};

export default settingsApi;
