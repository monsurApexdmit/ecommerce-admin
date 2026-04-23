import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({ baseURL: API_URL, withCredentials: true });

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
  if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketCategory = 'order' | 'product' | 'payment' | 'shipping' | 'general';

export interface SupportMessage {
  id: number;
  ticketId: number;
  customerId: number | null;
  body: string;
  senderType: 'customer' | 'staff';
  senderName: string | null;
  createdAt: string;
}
export type { SupportMessage as SupportMessageType };

export interface SupportTicket {
  id: number;
  companyId: number;
  customerId: number | null;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  customerName: string | null;
  customerEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messages: SupportMessage[];
}

export interface TicketStats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total: number;
}

export interface TicketListResponse {
  success: boolean;
  message: string;
  data: SupportTicket[];
  meta: { total: number; perPage: number; currentPage: number; lastPage: number };
}

export const supportApi = {
  getAll: async (params?: {
    status?: TicketStatus | 'all';
    priority?: TicketPriority | 'all';
    category?: TicketCategory | 'all';
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<TicketListResponse> => {
    const cleaned = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v && v !== 'all')
    );
    const res = await api.get('/support/tickets', { params: cleaned });
    return res.data;
  },

  getStats: async (): Promise<TicketStats> => {
    const res = await api.get('/support/tickets/stats');
    return res.data.data;
  },

  get: async (id: number): Promise<SupportTicket> => {
    const res = await api.get(`/support/tickets/${id}`);
    return res.data.data;
  },

  reply: async (id: number, body: string): Promise<SupportTicket> => {
    const res = await api.post(`/support/tickets/${id}/reply`, { body });
    return res.data.data;
  },

  updateStatus: async (id: number, status: TicketStatus): Promise<SupportTicket> => {
    const res = await api.patch(`/support/tickets/${id}/status`, { status });
    return res.data.data;
  },

  updatePriority: async (id: number, priority: TicketPriority): Promise<SupportTicket> => {
    const res = await api.patch(`/support/tickets/${id}/priority`, { priority });
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/support/tickets/${id}`);
  },
};

export default supportApi;
