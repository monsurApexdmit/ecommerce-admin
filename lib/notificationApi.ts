import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
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
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}, (error) => Promise.reject(error));

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

export type NotificationType = 'order' | 'stock_alert' | 'payment' | 'system' | 'support' | 'review';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  readAt: string | null;
  actionUrl: string | null;
  data: Record<string, any> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  message: string;
  data: NotificationResponse[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  message: string;
  data: { count: number };
}

export const notificationApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: 'read' | 'unread';
  }): Promise<NotificationListResponse> => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: number): Promise<{ message: string }> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAsUnread: async (id: number): Promise<{ message: string }> => {
    const response = await api.patch(`/notifications/${id}/unread`);
    return response.data;
  },

  markAllAsRead: async (): Promise<{ message: string }> => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  bulkDelete: async (ids: number[]): Promise<{ message: string }> => {
    const response = await api.delete('/notifications/bulk', { data: { ids } });
    return response.data;
  },
};

export default notificationApi;
