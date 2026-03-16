/**
 * SaaS Billing API Service
 * Handles plans, subscriptions, payments, and invoices
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

export interface PlanFeature {
  id: number;
  name: string;
  description: string;
}

export interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  durationDays: number;
  isPopular: boolean;
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  features: PlanFeature[];
  createdAt: string;
}

export interface GetPlansResponse {
  message: string;
  data: {
    plans: Plan[];
  };
}

export interface Subscription {
  id: number;
  companyId: number;
  planId: number;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  nextBillingDate: string;
  autoRenew: boolean;
  licenseKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetSubscriptionResponse {
  message: string;
  data: Subscription;
}

export interface PaymentRecord {
  id: number;
  subscriptionId: number;
  companyId: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentMethod: string;
  paymentDate: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  transactionId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface GetPaymentHistoryResponse {
  message: string;
  data: {
    payments: PaymentRecord[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface PaymentPayload {
  planId: number;
  planName: string;
  amount: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  paymentMethodId?: string;
  stripeTokenId?: string;
  autoRenew: boolean;
  useExistingPaymentMethod?: boolean;
}

export interface ProcessPaymentResponse {
  message: string;
  data: {
    paymentId: number;
    subscriptionId: number;
    status: 'paid' | 'pending';
    licenseKey: string;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    invoiceUrl?: string;
    nextBillingDate: string;
  };
}

export interface UpgradeSubscriptionPayload {
  newPlanId: number;
  prorationBillingCycle: 'immediate' | 'next_billing';
}

export interface UpgradeSubscriptionResponse {
  message: string;
  data: {
    subscriptionId: number;
    planId: number;
    planName: string;
    price: number;
    prorationCredit?: number;
    additionalCharge?: number;
    status: 'active' | 'pending_upgrade';
    createdAt: string;
  };
}

export interface CancelSubscriptionPayload {
  reason?: string;
  feedback?: string;
}

export interface CancelSubscriptionResponse {
  message: string;
  data: {
    subscriptionId: number;
    status: 'cancelled';
    cancelledAt: string;
    finalBillingDate: string;
    refund?: number;
  };
}

export interface UpdateAutoRenewPayload {
  autoRenew: boolean;
}

export interface UpdateAutoRenewResponse {
  message: string;
  data: {
    subscriptionId: number;
    autoRenew: boolean;
  };
}

export interface RenewSubscriptionPayload {
  subscriptionId: number;
  paymentMethodId?: string;
  autoRenew?: boolean;
}

export interface RenewSubscriptionResponse {
  message: string;
  data: {
    subscriptionId: number;
    status: 'active';
    currentPeriodEnd: string;
    nextBillingDate: string;
    licenseKey: string;
    invoiceUrl?: string;
  };
}

export interface PaymentMethodPayload {
  stripeTokenId?: string;
  cardLastFour?: string;
  cardBrand?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
}

export interface SavePaymentMethodResponse {
  message: string;
  data: {
    paymentMethodId: string;
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export interface GetPaymentMethodsResponse {
  message: string;
  data: {
    paymentMethods: Array<{
      id: string;
      last4: string;
      brand: string;
      expiryMonth: number;
      expiryYear: number;
      isDefault: boolean;
    }>;
  };
}

export interface DownloadInvoiceResponse {
  url: string;
  filename: string;
}

export interface TrialInfoResponse {
  message: string;
  data: {
    isTrialActive: boolean;
    trialStartDate: string;
    trialEndDate: string;
    daysRemaining: number;
    daysUsed: number;
    trialLicenseKey: string;
  };
}

// ============ API METHODS ============

export const saasBillingApi = {
  /**
   * GET /billing/plans
   * Get all available subscription plans
   */
  getPlans: async () => {
    const response = await api.get<GetPlansResponse>('/billing/plans');
    return response.data;
  },

  /**
   * GET /billing/subscription/current
   * Get current company subscription
   */
  getCurrentSubscription: async () => {
    const response = await api.get<GetSubscriptionResponse>('/billing/subscription/current');
    return response.data;
  },

  /**
   * GET /billing/payments/history?page=1&limit=10
   * Get payment history
   */
  getPaymentHistory: async (page = 1, limit = 10) => {
    const response = await api.get<GetPaymentHistoryResponse>('/billing/payments/history', {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * POST /billing/payments/process
   * Process payment and create subscription
   */
  processPayment: async (payload: PaymentPayload) => {
    const response = await api.post<ProcessPaymentResponse>('/billing/payments/process', payload);
    return response.data;
  },

  /**
   * POST /billing/subscription/upgrade
   * Upgrade subscription to higher plan
   */
  upgradeSubscription: async (payload: UpgradeSubscriptionPayload) => {
    const response = await api.post<UpgradeSubscriptionResponse>(
      '/billing/subscription/upgrade',
      payload
    );
    return response.data;
  },

  /**
   * POST /billing/subscription/cancel
   * Cancel subscription
   */
  cancelSubscription: async (payload: CancelSubscriptionPayload) => {
    const response = await api.post<CancelSubscriptionResponse>(
      '/billing/subscription/cancel',
      payload
    );
    return response.data;
  },

  /**
   * PATCH /billing/subscriptions/auto-renew
   * Update auto-renewal setting
   */
  updateAutoRenew: async (payload: UpdateAutoRenewPayload) => {
    const response = await api.patch<UpdateAutoRenewResponse>(
      '/billing/subscriptions/auto-renew',
      payload
    );
    return response.data;
  },

  /**
   * POST /billing/subscription/renew
   * Manually renew expired subscription
   */
  renewSubscription: async (payload: RenewSubscriptionPayload) => {
    const response = await api.post<RenewSubscriptionResponse>(
      '/billing/subscription/renew',
      payload
    );
    return response.data;
  },

  /**
   * POST /billing/payment-methods
   * Save new payment method
   */
  savePaymentMethod: async (payload: PaymentMethodPayload) => {
    const response = await api.post<SavePaymentMethodResponse>('/billing/payment-methods', payload);
    return response.data;
  },

  /**
   * GET /billing/payment-methods
   * Get saved payment methods
   */
  getPaymentMethods: async () => {
    const response = await api.get<GetPaymentMethodsResponse>('/billing/payment-methods');
    return response.data;
  },

  /**
   * DELETE /billing/payment-methods/:id
   * Delete payment method
   */
  deletePaymentMethod: async (paymentMethodId: string) => {
    const response = await api.delete(`/billing/payment-methods/${paymentMethodId}`);
    return response.data;
  },

  /**
   * GET /billing/invoices/:id/download
   * Download invoice PDF
   */
  downloadInvoice: async (invoiceId: number) => {
    const response = await api.get<DownloadInvoiceResponse>(`/billing/invoices/${invoiceId}/download`);
    return response.data;
  },

  /**
   * GET /billing/trial/info
   * Get trial information
   */
  getTrialInfo: async () => {
    const response = await api.get<TrialInfoResponse>('/billing/trial/info');
    return response.data;
  },

  /**
   * POST /billing/trial/extend
   * Extend trial period (admin only)
   */
  extendTrial: async (days: number) => {
    const response = await api.post('/billing/trial/extend', { days });
    return response.data;
  },
};

export default saasBillingApi;
