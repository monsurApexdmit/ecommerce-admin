"use client"

import Link from "next/link"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useDashboardSection } from "./use-dashboard-section"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useDashboardFilters } from "./dashboard-context"

const quick =
  "inline-flex h-10 items-center rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold text-dash-ink hover:bg-dash-neutral-soft"

export function Greeting() {
  const { user } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const { filters } = useDashboardFilters()
  const kpis = useDashboardSection("kpis")

  const hour = new Date().getHours()
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const first = user?.fullName?.split(" ")[0]
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const exportReport = () => {
    const d = kpis.data
    if (!d) return
    exportToCSV(
      [
        ["Net revenue", formatCurrency(d.revenue.value)],
        ["Gross profit", formatCurrency(d.grossProfit.value)],
        ["Orders", String(d.orders.value)],
        ["Average order value", formatCurrency(d.orders.aov)],
        ["Inventory value at cost", formatCurrency(d.inventory.valueAtCost)],
        ["Receivable", formatCurrency(d.receivable.value)],
        ["Payable", formatCurrency(d.payable.value)],
      ],
      `dashboard-${filters.from}_${filters.to}`,
      ["Metric", "Value"],
    )
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[13px] text-dash-muted">{today}</p>
        <h1 className="font-dash-display text-[28px] font-bold tracking-tight text-dash-ink sm:text-[34px]">
          {hello}{first ? `, ${first}` : ""}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/vendors/purchase-orders" className={quick}>Receive stock</Link>
        <Link href="/dashboard/vendors/purchase-orders?new=1" className={quick}>Create purchase order</Link>
        <button type="button" onClick={exportReport} disabled={!kpis.data} className={`${quick} disabled:opacity-50`}>
          Export report
        </button>
      </div>
    </div>
  )
}
