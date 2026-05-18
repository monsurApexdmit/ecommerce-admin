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

export interface ProductSerial {
  id: number
  companyId: number
  productId: number
  productName: string
  variantId?: number
  variantName?: string
  locationId?: number
  locationName?: string
  serialNumber: string
  status: "available" | "sold" | "returned" | "damaged"
  purchaseOrderNumber?: string
  receivedDate?: string
  soldInSellId?: number
  soldDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ProductBatch {
  id: number
  companyId: number
  productId: number
  productName: string
  variantId?: number
  variantName?: string
  locationId?: number
  locationName?: string
  batchNumber: string
  quantityReceived: number
  quantityRemaining: number
  manufactureDate?: string
  expiryDate?: string
  purchaseOrderNumber?: string
  receivedDate?: string
  notes?: string
  isExpired: boolean
  isExpiringSoon: boolean
  createdAt: string
  updatedAt: string
}

export interface InventoryMovement {
  id: number
  type: string
  productId: number
  productName?: string
  variantId?: number
  variantName?: string
  locationId?: number
  locationName?: string
  referenceType?: string
  referenceId?: number
  serialNumber?: string
  batchNumber?: string
  quantity: number
  notes?: string
  createdBy?: string
  createdAt: string
}

export interface SerialBatchStats {
  serials: { total: number; available: number; sold: number; other: number }
  batches: { total: number; expired: number; expiringSoon: number; active: number }
}

export interface CreateSerialsData {
  productId: number
  variantId?: number
  locationId?: number
  serials: { serialNumber: string; purchaseOrderNumber?: string; receivedDate?: string; notes?: string }[]
}

export interface CreateBatchData {
  productId: number
  variantId?: number
  locationId?: number
  batchNumber: string
  quantityReceived: number
  manufactureDate?: string
  expiryDate?: string
  purchaseOrderNumber?: string
  receivedDate?: string
  notes?: string
}

function paginatedResponse(r: { data: any }) {
  return {
    data: r.data?.data?.data ?? r.data?.data ?? [],
    total: r.data?.data?.total ?? 0,
    per_page: r.data?.data?.per_page ?? 50,
    current_page: r.data?.data?.current_page ?? 1,
    last_page: r.data?.data?.last_page ?? 1,
  }
}

export const serialBatchApi = {
  // ── Serials ─────────────────────────────────────────────────────────────
  getSerials: (params?: Record<string, any>) =>
    api.get("/serials", { params }).then(paginatedResponse),

  getSerial: (id: number) =>
    api.get(`/serials/${id}`).then((r: { data: any }) => r.data.data as ProductSerial),

  createSerials: (data: CreateSerialsData) =>
    api.post("/serials", data).then((r: { data: any }) => r.data.data as ProductSerial[]),

  updateSerial: (id: number, data: Partial<ProductSerial>) =>
    api.put(`/serials/${id}`, data).then((r: { data: any }) => r.data.data as ProductSerial),

  deleteSerial: (id: number) =>
    api.delete(`/serials/${id}`),

  // ── Batches ─────────────────────────────────────────────────────────────
  getBatches: (params?: Record<string, any>) =>
    api.get("/batches", { params }).then(paginatedResponse),

  getBatch: (id: number) =>
    api.get(`/batches/${id}`).then((r: { data: any }) => r.data.data as ProductBatch),

  createBatch: (data: CreateBatchData) =>
    api.post("/batches", data).then((r: { data: any }) => r.data.data as ProductBatch),

  updateBatch: (id: number, data: Partial<ProductBatch>) =>
    api.put(`/batches/${id}`, data).then((r: { data: any }) => r.data.data as ProductBatch),

  deleteBatch: (id: number) =>
    api.delete(`/batches/${id}`),

  // ── Movements ────────────────────────────────────────────────────────────
  getMovements: (params?: Record<string, any>) =>
    api.get("/inventory-movements", { params }).then(paginatedResponse),

  // ── Stats ────────────────────────────────────────────────────────────────
  getStats: () =>
    api.get("/serials/stats").then((r: { data: any }) => r.data.data as SerialBatchStats),
}
