/**
 * Reports API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export type ReportType = 'sales' | 'purchases' | 'stock' | 'dues' | 'pnl';
export type Tone = 'blue' | 'teal' | 'purple' | 'amber' | 'red';

export interface ReportKpi {
  label: string;
  value: number | string;
  kind: 'money' | 'int' | 'text';
  sub: string;
  subMoney?: { prefix: string; amount: number; suffix: string };
  tone: Tone;
  subTone?: 'muted' | 'red' | 'amber' | 'teal';
}

export interface ReportCell { t: 'text' | 'money' | 'int' | 'pct'; v: string | number; bold?: boolean }

export interface ReportTable {
  title: string;
  empty: string;
  columns: string[];
  rows: ReportCell[][];
  totalRow?: ReportCell[] | null;
}

export interface Report {
  type: ReportType;
  period: { from: string | null; to: string | null } | null;
  subtitle: string;
  kpis: ReportKpi[];
  chart: { title: string; signed: boolean; bars: { label: string; value: number }[] } | null;
  mixes: { title: string; kind: 'money' | 'int'; items: { label: string; value: number }[] }[];
  tables: ReportTable[];
}

export const reportsApi = {
  get: async (type: ReportType, params?: { from?: string; to?: string }): Promise<Report> => {
    const res = await api.get(`/reports/${type}`, { params });
    return res.data.data;
  },
};

export default reportsApi;
