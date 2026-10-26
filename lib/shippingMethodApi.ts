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

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface ShippingMethod {
  id: number
  name: string
  type: 'delivery' | 'pickup'
  description: string | null
  areasCovered: string | null
  price: number
  expressRate: number
  estimatedDays: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
}

export interface ShippingMethodPayload {
  name: string
  type?: 'delivery' | 'pickup'
  description?: string
  areas_covered?: string
  price: number
  express_rate?: number
  estimated_days?: string
  icon?: string
  is_active?: boolean
  sort_order?: number
}

export const shippingMethodApi = {
  getAll: async (): Promise<ShippingMethod[]> => {
    const res = await api.get('/shipping-methods')
    return res.data.data ?? []
  },

  create: async (data: ShippingMethodPayload): Promise<ShippingMethod> => {
    const res = await api.post('/shipping-methods', data)
    return res.data.data
  },

  update: async (id: number, data: Partial<ShippingMethodPayload>): Promise<ShippingMethod> => {
    const res = await api.put(`/shipping-methods/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/shipping-methods/${id}`)
  },

  toggle: async (id: number): Promise<ShippingMethod> => {
    const res = await api.patch(`/shipping-methods/${id}/toggle`)
    return res.data.data
  },
}

export interface CourierAccount {
  id: number
  provider: string
  accountId: string | null
  apiKey: string | null
  hasKey: boolean
  isActive: boolean
}

export const courierAccountApi = {
  getAll: async (): Promise<CourierAccount[]> => (await api.get('/courier-accounts')).data.data ?? [],
  create: async (data: { provider: string; accountId?: string; apiKey?: string; isActive?: boolean }): Promise<CourierAccount> =>
    (await api.post('/courier-accounts', data)).data.data,
  update: async (id: number, data: { accountId?: string; apiKey?: string; isActive?: boolean }): Promise<CourierAccount> =>
    (await api.put(`/courier-accounts/${id}`, data)).data.data,
  delete: async (id: number): Promise<void> => { await api.delete(`/courier-accounts/${id}`) },
}

export default shippingMethodApi
