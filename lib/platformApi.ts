import axios from 'axios'

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalCompanies: number
  activeCompanies: number
  trialCompanies: number
  inactiveCompanies: number
  activeSubscriptions: number
  mrr: number
  totalUsers: number
  totalPlans: number
  activePlans: number
}

export interface PlatformSubscription {
  id: number
  status: string
  planId: number | null
  planName: string | null
  planPrice: number | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  autoRenew: boolean
  cancelledAt: string | null
}

export interface PlatformCompany {
  id: number
  name: string
  email: string | null
  phone: string | null
  country: string | null
  status: string
  usersCount: number
  createdAt: string
  subscription: PlatformSubscription | null
  users?: PlatformUser[]
}

export interface PlatformUser {
  id: number
  fullName: string
  email: string
  role: string
  status: string
  joinedDate: string | null
  lastLogin: string | null
}

export interface PlatformPlan {
  id: number
  name: string
  description: string | null
  price: number
  maxUsers: number
  maxProducts: number
  maxBranches: number
  features: string[]
  isFeatured: boolean
  isActive: boolean
  createdAt: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const platformApi = {
  getStats: async (): Promise<PlatformStats> => {
    const r = await api.get('/platform/stats')
    return r.data.data
  },

  listCompanies: async (params?: { search?: string; status?: string; per_page?: number; page?: number }): Promise<{ data: PlatformCompany[]; pagination: any }> => {
    const r = await api.get('/platform/companies', { params })
    return { data: r.data.data, pagination: r.data.meta?.pagination }
  },

  getCompany: async (id: number): Promise<PlatformCompany> => {
    const r = await api.get(`/platform/companies/${id}`)
    return r.data.data
  },

  updateCompanyStatus: async (id: number, status: string): Promise<void> => {
    await api.patch(`/platform/companies/${id}/status`, { status })
  },

  listCompanyUsers: async (id: number): Promise<PlatformUser[]> => {
    const r = await api.get(`/platform/companies/${id}/users`)
    return r.data.data
  },

  assignSubscription: async (companyId: number, planId: number, months?: number): Promise<PlatformSubscription> => {
    const r = await api.post(`/platform/companies/${companyId}/subscription`, { planId, months })
    return r.data.data
  },

  cancelSubscription: async (companyId: number): Promise<void> => {
    await api.delete(`/platform/companies/${companyId}/subscription`)
  },

  listPlans: async (): Promise<PlatformPlan[]> => {
    const r = await api.get('/platform/plans')
    return r.data.data
  },

  createPlan: async (data: Partial<PlatformPlan> & { price: number }): Promise<PlatformPlan> => {
    const r = await api.post('/platform/plans', data)
    return r.data.data
  },

  updatePlan: async (id: number, data: Partial<PlatformPlan>): Promise<PlatformPlan> => {
    const r = await api.put(`/platform/plans/${id}`, data)
    return r.data.data
  },

  togglePlanStatus: async (id: number): Promise<void> => {
    await api.patch(`/platform/plans/${id}/toggle`)
  },
}
