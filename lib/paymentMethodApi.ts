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

export type PaymentGatewayType = 'cod' | 'sslcommerz' | 'portwallet'

export interface PaymentMethod {
  id: number
  name: string
  description: string | null
  icon: string | null
  gateway_type: PaymentGatewayType
  isActive: boolean
  sortOrder: number
}

export interface PaymentMethodPayload {
  name: string
  description?: string
  icon?: string
  gateway_type?: PaymentGatewayType
  isActive?: boolean
  sortOrder?: number
}

export const paymentMethodApi = {
  getAll: async (): Promise<PaymentMethod[]> => {
    const res = await api.get('/payment-methods')
    return res.data.data ?? []
  },

  create: async (data: PaymentMethodPayload): Promise<PaymentMethod> => {
    const res = await api.post('/payment-methods', data)
    return res.data.data
  },

  update: async (id: number, data: Partial<PaymentMethodPayload>): Promise<PaymentMethod> => {
    const res = await api.put(`/payment-methods/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/payment-methods/${id}`)
  },

  toggle: async (id: number): Promise<PaymentMethod> => {
    const res = await api.patch(`/payment-methods/${id}/toggle`)
    return res.data.data
  },
}

export default paymentMethodApi
