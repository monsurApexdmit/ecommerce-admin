"use client"

import { createContext, useContext, useMemo, useState } from "react"
import type { DashboardFilters } from "@/lib/dashboard/types"

export type RangePreset = "today" | "7d" | "30d" | "year"

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "7D",
  "30d": "30D",
  year: "This year",
}

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
