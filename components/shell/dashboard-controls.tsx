"use client"

import { Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWarehouse } from "@/contexts/warehouse-context"
import { RANGE_LABELS, type RangePreset, useDashboardFilters } from "@/components/dashboard/dashboard-context"
import { cn } from "@/lib/utils"

/** Date range + branch scope. Shown inside the header on the dashboard, as in the design. */
export function DashboardControls() {
  const { preset, setPreset, locationId, setLocationId } = useDashboardFilters()
  const { warehouses } = useWarehouse()

  return (
    <>
      <div
        role="group"
        aria-label="Date range"
        className="flex gap-1 rounded-xl bg-[#F0F2F7] p-1 dark:bg-[#1A2246]"
      >
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
            className={cn(
              "h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
              preset === p
                ? "bg-white text-[#0E1525] shadow-[0_1px_2px_rgba(14,21,37,0.12)] dark:bg-[#323C69] dark:text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {RANGE_LABELS[p]}
          </button>
        ))}
      </div>

      <Select
        value={locationId ? String(locationId) : "all"}
        onValueChange={(v) => setLocationId(v === "all" ? undefined : Number(v))}
      >
        <SelectTrigger
          aria-label="Location"
          className="h-11 w-[170px] rounded-xl border-[var(--shell-line-strong)] bg-card text-[13px] font-semibold shadow-none"
        >
          <Building2 className="size-4 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
