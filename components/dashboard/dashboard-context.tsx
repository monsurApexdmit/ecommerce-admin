"use client"

import { createContext, useContext, useMemo, useState } from "react"
import type { DashboardFilters } from "@/lib/dashboard/types"

export type RangePreset = "today" | "7d" | "30d" | "year"

/** Translation keys for the range picker (translated at render). */
export const RANGE_LABELS = {
  today: "common:time.today",
  "7d": "dashboard:range.d7",
  "30d": "dashboard:range.d30",
  year: "dashboard:range.year",
} as const satisfies Record<RangePreset, string>

/** Translation keys for the selected period, e.g. "Last 7 days". */
export const PERIOD_LABELS = {
  today: "common:time.today",
  "7d": "common:time.last7Days",
  "30d": "common:time.last30Days",
  year: "dashboard:range.year",
} as const satisfies Record<RangePreset, string>

/** Translation keys for the period inside a sentence, e.g. "Cash in · last 7 days". */
export const PERIOD_INLINE_LABELS = {
  today: "dashboard:periodInline.today",
  "7d": "dashboard:periodInline.d7",
  "30d": "dashboard:periodInline.d30",
  year: "dashboard:periodInline.year",
} as const satisfies Record<RangePreset, string>

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export function rangeFor(preset: RangePreset): { from: string; to: string } {
  const now = new Date()
  const to = iso(now)
  switch (preset) {
    case "today":
      return { from: to, to }
    case "7d": {
      const s = new Date(now)
      s.setDate(s.getDate() - 6)
      return { from: iso(s), to }
    }
    case "30d": {
      const s = new Date(now)
      s.setDate(s.getDate() - 29)
      return { from: iso(s), to }
    }
    default:
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to }
  }
}

interface DashboardContextValue {
  preset: RangePreset
  setPreset: (p: RangePreset) => void
  locationId?: number
  setLocationId: (id?: number) => void
  filters: DashboardFilters
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

/** Holds the date range + branch that drive every dashboard section. */
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<RangePreset>("year")
  const [locationId, setLocationId] = useState<number | undefined>(undefined)

  const filters = useMemo<DashboardFilters>(
    () => ({ ...rangeFor(preset), locationId }),
    [preset, locationId],
  )

  const value = useMemo(
    () => ({ preset, setPreset, locationId, setLocationId, filters }),
    [preset, locationId, filters],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboardFilters must be used inside DashboardProvider")
  return ctx
}
