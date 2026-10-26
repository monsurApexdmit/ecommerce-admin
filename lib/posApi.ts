/**
 * POS API: register shifts (cash drawer), held sales and best-seller counts.
 * Proxied through the Next.js API route like the other *Api.ts services.
 */
import axios from "axios"
import { getCompanyId } from "@/lib/utils/apiInterceptor"

const api = axios.create({
  baseURL: "/api/proxy",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      const companyId = getCompanyId()
      if (companyId) config.params = { ...(config.params ?? {}), company_id: companyId }
    }
  }
  return config
})

export interface CashMovement {
  id: number
  type: "in" | "out"
  amount: number
  reason: string
  createdAt: string
}

export interface ShiftSummary {
  opening: number
  cashSales: number
  saleCount: number
  collections: number
  cashIn: number
  cashOut: number
  refunds: number
  expenses: number
  supplierPaid: number
  nonCashSales: number
  expected: number
  movements: CashMovement[]
}

export interface RegisterSession {
  id: number
  no: string
  register: string
  locationId: number | null
  status: "open" | "closed"
  openedBy: string | null
  openedAt: string
  closedAt: string | null
  openingCash: number
  expectedCash: number | null
  countedCash: number | null
  variance: number | null
  closeNote: string | null
  summary?: ShiftSummary | null
}

export interface HeldSale {
  id: number
  label: string
  customerId: number | null
  itemCount: number
  total: number
  payload: Record<string, any>
  createdAt: string
}

export const REGISTERS = ["Register 1", "Register 2"]

export const posApi = {
  getShift: async (register?: string): Promise<{ session: RegisterSession | null; history: RegisterSession[] }> => {
    const res = await api.get("/pos/shift", { params: register ? { register } : {} })
    return res.data.data
  },

  openShift: async (data: { register: string; locationId?: number; openingCash: number }): Promise<RegisterSession> => {
    const res = await api.post("/pos/shift/open", data)
    return res.data.data
  },

  cashMovement: async (id: number, data: { type: "in" | "out"; amount: number; reason: string }): Promise<RegisterSession> => {
    const res = await api.post(`/pos/shift/${id}/movement`, data)
    return res.data.data
  },

  closeShift: async (id: number, data: { counted: number; note?: string }): Promise<RegisterSession> => {
    const res = await api.post(`/pos/shift/${id}/close`, data)
    return res.data.data
  },

  getHeld: async (): Promise<HeldSale[]> => {
    const res = await api.get("/pos/held")
    return res.data.data ?? []
  },

  holdSale: async (data: { label?: string; customerId?: number | null; itemCount: number; total: number; payload: Record<string, any> }): Promise<HeldSale> => {
    const res = await api.post("/pos/held", data)
    return res.data.data
  },

  dropHeld: async (id: number): Promise<void> => {
    await api.delete(`/pos/held/${id}`)
  },

  /** productId → units sold in the last N days (0 = all sales) */
  getBestSellers: async (days = 0): Promise<Record<string, number>> => {
    const res = await api.get("/pos/best-sellers", { params: { days } })
    return res.data.data ?? {}
  },
}

export function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  const first = e?.response?.data?.errors ? Object.values(e.response.data.errors)[0]?.[0] : undefined
  return first ?? e?.response?.data?.message ?? fallback
}
