/**
 * Notification preferences API
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

export type NotifChannel = 'app' | 'email' | 'sms' | 'cust';

export interface NotifEventDef {
  key: string;
  group: string;
  name: string;
  sub: string;
  na: NotifChannel[];
}

export interface NotifPreferences {
  events: Record<string, Record<NotifChannel, boolean>>;
  quietFrom: string;
  quietTo: string;
  smsTemplate: string;
}

export interface NotifPreferencesResponse {
  events: NotifEventDef[];
  preferences: NotifPreferences;
  smsBalance: number;
  smsProviderConnected: boolean;
  preview: { business: string; sale: { no: string; customer: string; total: number } | null };
}

export const notificationPreferencesApi = {
  get: async (): Promise<NotifPreferencesResponse> => {
    const res = await api.get('/settings/notification-preferences');
    return res.data.data;
  },
  save: async (prefs: NotifPreferences): Promise<NotifPreferencesResponse> => {
    const res = await api.put('/settings/notification-preferences', prefs);
    return res.data.data;
  },
};

export default notificationPreferencesApi;
