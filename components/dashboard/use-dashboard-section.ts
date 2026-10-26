"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchSection } from "@/lib/dashboard/api"
import type { SectionKey, SectionMap } from "@/lib/dashboard/types"
import { useDashboardFilters } from "./dashboard-context"

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Loads one dashboard section. Re-fetches when the range/branch changes, cancels stale
 * requests, and keeps its own error state so one failing section never breaks the page.
 */
export function useDashboardSection<K extends SectionKey>(section: K, extra?: { limit?: number; to?: string }) {
  const { filters } = useDashboardFilters()
  const [state, setState] = useState<State<SectionMap[K]>>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  const limit = extra?.limit
  const toOverride = extra?.to

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchSection(section, toOverride ? { ...filters, to: toOverride } : filters, limit ? { limit } : undefined, controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return
        setState((s) => ({
          data: s.data,
          loading: false,
          error: err?.response?.data?.message ?? "Could not load this section",
        }))
      })
    return () => controller.abort()
  }, [section, filters, limit, toOverride, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
