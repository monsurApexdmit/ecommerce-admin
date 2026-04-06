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
   * GET /billing/subscription
   * Get current company subscription
   */
  getCurrentSubscription: async () => {
    const response = await api.get<GetSubscriptionResponse>('/billing/subscription');
    return response.data;
  },

  /**
   * GET /billing/payments
   * Get payment history
   */
  getPaymentHistory: async (page = 1, limit = 10) => {
    const response = await api.get<GetPaymentHistoryResponse>('/billing/payments', {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * POST /billing/create-subscription
   * Create new subscription (process payment)
   */
  processPayment: async (payload: PaymentPayload) => {
    const response = await api.post<ProcessPaymentResponse>('/billing/create-subscription', payload);
    return response.data;
  },

  /**
   * POST /billing/upgrade
   * Upgrade subscription to higher plan
   */
  upgradeSubscription: async (payload: UpgradeSubscriptionPayload) => {
    const response = await api.post<UpgradeSubscriptionResponse>(
      '/billing/upgrade',
      payload
    );
    return response.data;
  },

  /**
   * POST /billing/cancel
   * Cancel subscription
   */
  cancelSubscription: async (payload: CancelSubscriptionPayload) => {
    const response = await api.post<CancelSubscriptionResponse>(
      '/billing/cancel',
      payload
    );
    return response.data;
  },

  /**
   * POST /billing/renew
   * Renew expired subscription
   */
  renewSubscription: async (payload: RenewSubscriptionPayload) => {
    const response = await api.post<RenewSubscriptionResponse>(
      '/billing/renew',
      payload
    );
    return response.data;
  },

  /**
   * GET /billing/contact
   * Get billing contact information
   */
  getBillingContact: async () => {
    const response = await api.get('/billing/contact');
    return response.data;
  },

  /**
   * PUT /billing/contact
   * Update billing contact information
   */
  updateBillingContact: async (payload: any) => {
    const response = await api.put('/billing/contact', payload);
    return response.data;
  },

  /**
   * NOT IMPLEMENTED - Payment Methods
   * Backend does not have payment method endpoints yet
   */
  savePaymentMethod: async (payload: PaymentMethodPayload) => {
    throw new Error('Payment methods API not yet implemented on backend');
  },

  /**
   * NOT IMPLEMENTED - Get Payment Methods
   * Backend does not have payment method endpoints yet
   */
  getPaymentMethods: async () => {
    throw new Error('Payment methods API not yet implemented on backend');
  },

  /**
   * NOT IMPLEMENTED - Delete Payment Method
   * Backend does not have payment method endpoints yet
   */
  deletePaymentMethod: async (paymentMethodId: string) => {
    throw new Error('Payment methods API not yet implemented on backend');
  },

  /**
   * NOT IMPLEMENTED - Download Invoice
   * Backend does not have invoice download endpoint yet
   */
  downloadInvoice: async (invoiceId: number) => {
    throw new Error('Invoice download API not yet implemented on backend');
  },

  /**
   * NOT IMPLEMENTED - Trial Info
   * Backend does not have trial info endpoint yet
   */
  getTrialInfo: async () => {
    throw new Error('Trial info API not yet implemented on backend');
  },

  /**
   * NOT IMPLEMENTED - Extend Trial
   * Backend does not have trial extend endpoint yet
   */
  extendTrial: async (days: number) => {
    throw new Error('Trial extend API not yet implemented on backend');
  },
};

export default saasBillingApi;
