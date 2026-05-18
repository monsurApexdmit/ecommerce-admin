import axios from 'axios'
import { getCompanyId } from './utils/apiInterceptor'

const API_URL = '/api/proxy'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      const companyId = getCompanyId()
      if (companyId) {
        if (!config.params) config.params = {}
        config.params.company_id = companyId
      }
    }
  }
  return config
})

export interface PurchaseOrderItem {
  id: number
  productId: number
  productName: string
  productSku: string
  variantId: number | null
  variantName: string | null
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  subtotal: number
}

export interface PurchaseOrder {
  id: number
  companyId: number
  vendorId: number
  vendorName: string
  locationId: number | null
  locationName: string | null
  poNumber: string
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
  expectedDate: string | null
  notes: string | null
  totalAmount: number
  items: PurchaseOrderItem[]
  createdAt: string
  updatedAt: string
}

export interface CreatePurchaseOrderData {
  vendorId: number
  locationId?: number
  expectedDate?: string
  notes?: string
  items: {
    productId: number
    variantId?: number
    quantityOrdered: number
    unitCost: number
  }[]
}

export interface ReceiveItemsData {
  items: {
    itemId: number
    quantityReceiving: number
  }[]
}

const purchaseOrderApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/purchase-orders', { params }),

  getById: (id: number) =>
    api.get(`/purchase-orders/${id}`),

  getStats: () =>
    api.get('/purchase-orders/stats'),

  create: (data: CreatePurchaseOrderData) =>
    api.post('/purchase-orders', data),

  update: (id: number, data: Partial<CreatePurchaseOrderData> & { status?: string }) =>
    api.put(`/purchase-orders/${id}`, data),

  updateStatus: (id: number, status: string) =>
    api.patch(`/purchase-orders/${id}/status`, { status }),

  receive: (id: number, data: ReceiveItemsData) =>
    api.post(`/purchase-orders/${id}/receive`, data),

  delete: (id: number) =>
    api.delete(`/purchase-orders/${id}`),
}

export default purchaseOrderApi
