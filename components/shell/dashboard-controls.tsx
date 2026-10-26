"use client"

import { Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWarehouse } from "@/contexts/warehouse-context"
import { RANGE_LABELS, type RangePreset, useDashboardFilters } from "@/components/dashboard/dashboard-context"
import { SegmentedControl } from "@/components/common/SegmentedControl"

/** Date range + branch scope. Shown inside the header on the dashboard, as in the design. */
export function DashboardControls() {
  const { preset, setPreset, locationId, setLocationId } = useDashboardFilters()
  const { warehouses } = useWarehouse()

  return (
    <>
      <SegmentedControl
        aria-label="Date range"
        value={preset}
        onValueChange={(v) => setPreset(v as RangePreset)}
        options={(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => ({ value: p, label: RANGE_LABELS[p] }))}
      />

      <Select
        value={locationId ? String(locationId) : "all"}
        onValueChange={(v) => setLocationId(v === "all" ? undefined : Number(v))}
      >
        <SelectTrigger
          aria-label="Location"
          className="w-[170px]"
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
