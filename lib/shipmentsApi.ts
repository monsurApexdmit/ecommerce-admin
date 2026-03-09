/**
 * Shipments API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
 */

import axios from 'axios';

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

export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface TrackingEvent {
  id: number;
  shipmentId: number;
  status: ShipmentStatus;
  location?: string;
  description: string;
  eventTime: string;
  createdAt: string;
}

export interface ShipmentSell {
  id: number;
  invoiceNo: string;
  customerName: string;
  method: string;
  amount: number;
  status: string;
  shippedAt?: string;
}

export interface ShipmentResponse {
  id: number;
  sellId: number;
  sell?: ShipmentSell;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingHistory?: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    in_transit: number;
    delivered: number;
    failed: number;
    picked_up?: number;
    out_for_delivery?: number;
    returned?: number;
  };
}

export interface ShipmentListResponse {
  message: string;
  data: ShipmentResponse[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface CreateShipmentData {
  sellId: number;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status?: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
}

export interface AddTrackingEventData {
  status: ShipmentStatus;
  location?: string;
  description: string;
  eventTime?: string;
}

export const shipmentsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    carrier?: string;
  }): Promise<ShipmentListResponse> => {
    const response = await api.get('/shipments', { params });
    return response.data;
  },

  getStats: async (): Promise<ShipmentStatsResponse> => {
    const response = await api.get('/shipments/stats');
    return response.data;
  },

  getById: async (id: number): Promise<{ message: string; data: ShipmentResponse }> => {
    const response = await api.get(`/shipments/${id}`);
    return response.data;
  },

  create: async (data: CreateShipmentData): Promise<{ message: string; data: ShipmentResponse }> => {
    const response = await api.post('/shipments', data);
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: { status: ShipmentStatus; location?: string; description?: string }
  ): Promise<{ message: string; data: ShipmentResponse }> => {
    const response = await api.patch(`/shipments/${id}/status`, data);
    return response.data;
  },

  addTrackingEvent: async (
    id: number,
    data: AddTrackingEventData
  ): Promise<{ message: string; data: TrackingEvent }> => {
    const response = await api.post(`/shipments/${id}/tracking`, data);
    return response.data;
  },
};

export default shipmentsApi;
