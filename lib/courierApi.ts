/**
 * Courier integrations (Pathao, Steadfast): connected accounts, booking parcels from orders,
 * status sync / cancel / tracking. Contract: COURIER_API_CONTRACT.md.
 */
import axios from 'axios'
import { getCompanyId } from './utils/apiInterceptor'

const api = axios.create({
  baseURL: '/api/proxy',
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

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** Providers with an API driver. Other names are manual-only couriers. */
export type CourierProvider = 'pathao' | 'steadfast'
export const API_PROVIDERS: CourierProvider[] = ['pathao', 'steadfast']

export type CourierEnvironment = 'live' | 'sandbox'

/** Normalized courier status (the raw courier string is kept in `rawStatus`). */
export type CourierStatus =
  | 'booked'
  | 'pickup_pending'
  | 'picked'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'partial_delivered'
  | 'returned'
  | 'cancelled'
  | 'on_hold'
  | 'failed'

export const COURIER_STATUSES: CourierStatus[] = [
  'booked', 'pickup_pending', 'picked', 'in_transit', 'out_for_delivery', 'delivered',
  'partial_delivered', 'returned', 'cancelled', 'on_hold', 'failed',
]
export const FINAL_COURIER_STATUSES: CourierStatus[] = ['delivered', 'partial_delivered', 'returned', 'cancelled']

/** 48 = normal, 12 = on-demand (Pathao); 1 = document, 2 = parcel */
export type DeliveryType = 48 | 12
export type ItemType = 1 | 2

export interface CourierDefaults {
  deliveryType?: DeliveryType | null
  itemType?: ItemType | null
  weightKg?: number | null
  note?: string | null
  itemDescription?: string | null
}

export type ConnectionStatus = 'connected' | 'error' | 'untested'

export interface CourierAccount {
  id: number
  provider: string
  /** Display name ("Pathao") */
  label?: string | null
  /** Provider has an API driver (false for legacy free-text couriers) */
  isIntegrated?: boolean
  environment: CourierEnvironment | null
  isActive: boolean
  /** At most one per company */
  isDefault: boolean
  /** Legacy free-text id */
  accountId: string | null
  /** Masked values; only the provider's keys are present (pathao: clientId masked, username + storeId plain; steadfast: apiKey masked) */
  credentials?: { clientId?: string | null; username?: string | null; storeId?: string | number | null; apiKey?: string | null } | null
  hasClientId?: boolean
  hasClientSecret?: boolean
  hasPassword?: boolean
  hasApiKey?: boolean
  hasSecretKey?: boolean
  /** Legacy: has any secret */
  hasKey?: boolean
  /** Legacy masked key */
  apiKey?: string | null
  /** All required credentials present */
  isConfigured?: boolean
  /** Pathao without a pickup store yet */
  needsStore?: boolean
  settings?: CourierDefaults | null
  connectionStatus?: ConnectionStatus | string | null
  lastCheckedAt?: string | null
  lastError?: string | null
  /** Full callback URL (not on /courier/accounts) */
  webhookUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CourierAccountPayload {
  /** Required on create; one account per provider per company */
  provider?: string
  isActive?: boolean
  isDefault?: boolean
  /** Pathao only */
  environment?: CourierEnvironment
  accountId?: string | null
  /** Steadfast: apiKey, secretKey · Pathao: clientId, clientSecret, username, password, storeId. Blank secret = keep stored. */
  credentials?: { apiKey?: string; secretKey?: string; clientId?: string; clientSecret?: string; username?: string; password?: string; storeId?: number }
  settings?: CourierDefaults
}

export interface PathaoStore {
  id: number
  name: string
  address: string | null
  cityId: number | null
  zoneId: number | null
  isActive: boolean
  isDefault: boolean
}

export interface CourierTestResult {
  ok: boolean
  message: string | null
  /** Steadfast */
  balance?: number | null
  /** Pathao */
  stores?: PathaoStore[] | null
  account?: CourierAccount | null
}

export type LocationType = 'city' | 'zone' | 'area'
export interface CourierLocation {
  id: number
  name: string
  homeDeliveryAvailable?: boolean
  pickupAvailable?: boolean
}

export interface CourierWebhookInfo {
  url: string
  provider: string
  hasToken: boolean
  /** Full token (shown only on this endpoint) */
  token?: string | null
  tokenHint: string | null
  instructions: string | null
  /** Steadfast: the header value to paste ("Bearer <token>"), shown only here */
  authHeader?: string | null
}

/** `courierBooking` block on shipments and on `sell.shipments[]` (null for manual shipments). */
export interface CourierBooking {
  provider: string
  accountId: number | null
  consignmentId: string | null
  trackingCode: string | null
  status: CourierStatus | string | null
  rawStatus: string | null
  statusAt: string | null
  bookedAt: string | null
  trackingUrl: string | null
  /** Courier charge */
  deliveryFee: number | null
  /** COD requested from the courier */
  codAmount: number | null
  /** COD the courier reports collected */
  codCollected: number | null
  isFinal: boolean
  canCancel: boolean
  canSync: boolean
  lastSyncedAt: string | null
  syncError: string | null
  pathao?: {
    storeId: number | null
    cityId: number | null
    cityName: string | null
    zoneId: number | null
    zoneName: string | null
    areaId: number | null
    areaName: string | null
  } | null
}

export interface PathaoBookingOptions {
  storeId?: number
  cityId?: number
  zoneId?: number
  areaId?: number
  cityName?: string
  zoneName?: string
  areaName?: string
}

export interface BookParcelPayload {
  /** Optional → default account */
  courierAccountId?: number
  /** Optional → order due */
  codAmount?: number
  weightKg?: number
  deliveryType?: DeliveryType
  itemType?: ItemType
  itemDescription?: string
  note?: string
  recipient?: { name?: string; phone?: string; address?: string }
  pathao?: PathaoBookingOptions
}

export interface BulkBookPayload {
  /** max 100 */
  sellIds: number[]
  courierAccountId?: number
  defaults?: Omit<CourierDefaults, 'deliveryType' | 'itemType'> & { deliveryType?: DeliveryType; itemType?: ItemType }
}

export interface BulkBookResult {
  sellId: number
  invoiceNo: string | null
  ok: boolean
  shipmentId: number | null
  consignmentId: string | null
  trackingCode: string | null
  message: string | null
}

export interface BulkBookResponse {
  total: number
  succeeded: number
  failed: number
  results: BulkBookResult[]
}

export interface CourierQuote {
  available: boolean
  deliveryFee: number | null
  codFeePercent?: number | null
  currency?: string | null
  message: string | null
}

export interface CourierTrackingEvent {
  status: string | null
  message: string
  time: string | null
}

export interface CourierTracking {
  provider: string
  status: string | null
  rawStatus: string | null
  /** newest first */
  events: CourierTrackingEvent[]
}

export interface CourierRisk {
  available: boolean
  provider?: string | null
  phone?: string | null
  totalParcels: number | null
  delivered: number | null
  returned: number | null
  /** 0–100 */
  successRate: number | null
  rating: string | null
  message: string | null
}

/** Shipment returned by booking / sync / cancel (the full OrderShipment DTO). */
export interface CourierShipment {
  id: number
  sellId: number
  status: string
  trackingNumber?: string | null
  carrier?: string | null
  courierBooking?: CourierBooking | null
  [key: string]: unknown
}

const unwrap = <T,>(res: { data: any }): T => (res.data?.data ?? res.data) as T

/** Courier account setup (Shipping Methods permission). */
export const courierAccountApi = {
  getAll: async (): Promise<CourierAccount[]> => unwrap<CourierAccount[]>(await api.get('/courier-accounts')) ?? [],
  create: async (data: CourierAccountPayload): Promise<CourierAccount> => unwrap(await api.post('/courier-accounts', data)),
  update: async (id: number, data: CourierAccountPayload): Promise<CourierAccount> => unwrap(await api.put(`/courier-accounts/${id}`, data)),
  delete: async (id: number): Promise<void> => { await api.delete(`/courier-accounts/${id}`) },
  /** Always 200; `ok:false` + `message` on failure */
  test: async (id: number): Promise<CourierTestResult> => unwrap(await api.post(`/courier-accounts/${id}/test`)),
  setDefault: async (id: number): Promise<CourierAccount> => unwrap(await api.post(`/courier-accounts/${id}/default`)),
  stores: async (id: number): Promise<PathaoStore[]> => unwrap<PathaoStore[]>(await api.get(`/courier-accounts/${id}/stores`)) ?? [],
  webhook: async (id: number): Promise<CourierWebhookInfo> => unwrap(await api.get(`/courier-accounts/${id}/webhook`)),
  rotateWebhook: async (id: number): Promise<CourierWebhookInfo> => unwrap(await api.post(`/courier-accounts/${id}/webhook/rotate`)),
}

/** Booking, quotes and courier status for orders / shipments (Orders / Shipments permissions). */
export const courierApi = {
  /** Active + configured accounts for the booking dialogs */
  accounts: async (): Promise<CourierAccount[]> => unwrap<CourierAccount[]>(await api.get('/courier/accounts')) ?? [],
  locations: async (accountId: number, type: LocationType, parentId?: number): Promise<CourierLocation[]> =>
    unwrap<CourierLocation[]>(await api.get(`/courier/accounts/${accountId}/locations`, { params: { type, parentId } })) ?? [],
  stores: async (accountId: number): Promise<PathaoStore[]> => unwrap<PathaoStore[]>(await api.get(`/courier/accounts/${accountId}/stores`)) ?? [],
  /** Book one order; 409 when it is already booked with a courier. */
  book: async (sellId: number, data: BookParcelPayload): Promise<CourierShipment> => unwrap(await api.post(`/sells/${sellId}/courier`, data)),
  bulkBook: async (data: BulkBookPayload): Promise<BulkBookResponse> => unwrap(await api.post('/sells/courier/bulk', data)),
  quote: async (params: { courierAccountId?: number; sellId?: number; weightKg?: number; deliveryType?: DeliveryType; itemType?: ItemType; cityId?: number; zoneId?: number }): Promise<CourierQuote> =>
    unwrap(await api.get('/courier/quote', { params })),
  /** Optional endpoint (Pathao only) */
  risk: async (phone: string, courierAccountId?: number): Promise<CourierRisk> =>
    unwrap(await api.get('/courier/customer-risk', { params: { phone, courierAccountId } })),
  sync: async (shipmentId: number): Promise<CourierShipment> => unwrap(await api.post(`/shipments/${shipmentId}/courier/sync`)),
  /** Pathao only */
  cancel: async (shipmentId: number): Promise<CourierShipment> => unwrap(await api.post(`/shipments/${shipmentId}/courier/cancel`)),
  tracking: async (shipmentId: number): Promise<CourierTracking> => unwrap(await api.get(`/shipments/${shipmentId}/courier/tracking`)),
}

/** First validation message, else the API message, else `fallback`. */
export const courierError = (err: any, fallback: string): string => {
  const errors = err?.response?.data?.errors
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0]
    if (first) return String(first)
  }
  return err?.response?.data?.message || fallback
}

export const isApiProvider = (provider?: string | null): provider is CourierProvider =>
  API_PROVIDERS.includes(String(provider ?? '').toLowerCase() as CourierProvider)
