/**
 * Shipments API Service
 * Proxied through Next.js API route to avoid browser TLS issues with self-signed certs
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
  customerPhone?: string | null;
  customerAddress?: string | null;
  area?: string;
  source?: string | null;
  paymentStatus?: string;
  dueAmount?: number;
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
  codAmount?: number;
  codCollected?: boolean | number | null;
  codCollectedAmount?: number | null;
  codCollectedAt?: string | null;
  /** Server-derived COD state */
  codState?: string | null;
  rider?: string | null;
  package?: string | null;
  deliveryPayer?: 'customer' | 'us';
  deliverySpeed?: 'regular' | 'express' | null;
  pickupDate?: string | null;
  weight?: number;
  dimensions?: string;
  notes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingHistory?: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ReadyOrder {
  id: number;
  sellId: number;
  invoiceNo: string;
  customerName: string;
  customerPhone?: string | null;
  address?: string | null;
  amount: number;
  paidAmount?: number;
  dueAmount: number;
  shippingCost?: number;
  paymentMethod?: string;
  paymentLabel: 'Paid' | 'COD' | 'Unpaid' | string;
  isCod: boolean;
  itemCount: number;
  shippingMethod?: string | null;
  status?: string;
  orderTime?: string;
}

export interface ShipmentStatsResponse {
  message: string;
  data: {
    total: number;
    pending: number;
    pickedUp: number;
    inTransit: number;
    outForDelivery: number;
    delivered: number;
    failed: number;
    returned: number;
    totalShippingCost?: number;
    /** Orders that still need a shipment */
    readyToShip?: number;
    /** Unpaid COD cash still with couriers */
    codWithCouriers?: number;
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
  markShipped?: boolean;
  status?: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  codAmount?: number;
  deliveryPayer?: 'customer' | 'us';
  deliverySpeed?: 'regular' | 'express';
  pickupDate?: string;
  rider?: string;
  package?: string;
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
    days?: number;
    cod?: number;
    per_page?: number;
  }): Promise<ShipmentListResponse> => {
    const response = await api.get('/shipments', { params });
    // Laravel returns paginated response: { success, message, data: { data: [...], total, per_page, current_page } }
    const laravelData = response.data.data || {};
    return {
      message: response.data.message || '',
      data: laravelData.data || [],
      pagination: {
        page: laravelData.current_page || 1,
        per_page: laravelData.per_page || 10,
        total: laravelData.total || 0,
      },
    };
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

  /** Orders without a live shipment (server-side search, no cap) */
  getReadyToShip: async (params?: { search?: string; per_page?: number; page?: number }): Promise<{ orders: ReadyOrder[]; total: number }> => {
    const response = await api.get('/shipments/ready-to-ship', { params });
    const d = response.data?.data;
    const orders: ReadyOrder[] = (Array.isArray(d) ? d : d?.data) ?? [];
    return { orders, total: Number(d?.total ?? orders.length) };
  },

  /** Record that the courier handed over the COD cash */
  recordCodPayment: async (
    id: number,
    data?: { paymentMethod?: string; notes?: string }
  ): Promise<{ message: string; data: ShipmentResponse }> => {
    const response = await api.post(`/shipments/${id}/cod-payment`, data ?? {});
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: { status: ShipmentStatus; location?: string; description?: string; rider?: string }
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
