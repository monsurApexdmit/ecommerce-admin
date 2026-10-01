/**
 * Payment API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor for auth
api.interceptors.request.use(
  (config) => {
    // Check if running in browser (not SSR)
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

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      // Optionally redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface RecordPaymentData {
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNo?: string;
  notes?: string;
}

export interface DuePaymentResponse {
  id: number;
  companyId: number;
  payableType: string;
  payableId: number;
  direction: 'in' | 'out';
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNo?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const paymentApi = {
  /**
   * Record a payment against a payable entity (e.g. a sell/order)
   */
  recordPayment: async (
    payableType: 'sells' | 'purchase-orders',
    payableId: number,
    data: RecordPaymentData
  ): Promise<{ message: string; data: DuePaymentResponse }> => {
    const response = await api.post(`/payments/${payableType}/${payableId}`, {
      amount: data.amount,
      payment_method: data.paymentMethod,
      payment_date: data.paymentDate,
      reference: data.referenceNo,
      notes: data.notes,
    });
    return response.data;
  },
};

export default paymentApi;
