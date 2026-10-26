/**
 * Dashboard API client. Aggregation happens in the Laravel backend
 * (GET /dashboard/{section}); this file is the typed, one-function-per-section client.
 * Proxied through the Next.js API route like the other *Api.ts services.
 */
import axios from "axios"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import type { DashboardFilters, SectionKey, SectionMap } from "./types"

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

export async function fetchSection<K extends SectionKey>(
  section: K,
  filters: DashboardFilters,
  extra?: { limit?: number },
  signal?: AbortSignal,
): Promise<SectionMap[K]> {
  const res = await api.get(`/dashboard/${section}`, {
    params: {
      from: filters.from,
      to: filters.to,
      ...(filters.locationId ? { location_id: filters.locationId } : {}),
      ...(extra?.limit ? { limit: extra.limit } : {}),
    },
    signal,
  })
  return res.data.data as SectionMap[K]
}

export const dashboardApi = {
  alerts: (f: DashboardFilters, s?: AbortSignal) => fetchSection("alerts", f, undefined, s),
  kpis: (f: DashboardFilters, s?: AbortSignal) => fetchSection("kpis", f, undefined, s),
  revenue: (f: DashboardFilters, s?: AbortSignal) => fetchSection("revenue", f, undefined, s),
  pipeline: (f: DashboardFilters, s?: AbortSignal) => fetchSection("pipeline", f, undefined, s),
  stockHealth: (f: DashboardFilters, s?: AbortSignal) => fetchSection("stock-health", f, undefined, s),
  reorder: (f: DashboardFilters, s?: AbortSignal) => fetchSection("reorder", f, { limit: 8 }, s),
  topProducts: (f: DashboardFilters, s?: AbortSignal) => fetchSection("top-products", f, undefined, s),
  channels: (f: DashboardFilters, s?: AbortSignal) => fetchSection("channels", f, undefined, s),
  obligations: (f: DashboardFilters, s?: AbortSignal) => fetchSection("obligations", f, undefined, s),
  recentOrders: (f: DashboardFilters, s?: AbortSignal) => fetchSection("recent-orders", f, { limit: 6 }, s),
  activity: (f: DashboardFilters, s?: AbortSignal) => fetchSection("activity", f, { limit: 8 }, s),
}
