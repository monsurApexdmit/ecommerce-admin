"use client"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import Link from "next/link"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useDashboardSection } from "./use-dashboard-section"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useDashboardFilters } from "./dashboard-context"

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
    <PageHeader
      title={<>{hello}{first ? `, ${first}` : ""}</>}
      description={today}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/vendors/purchase-orders">Receive stock</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/vendors/purchase-orders?new=1">Create purchase order</Link>
          </Button>
          <Button type="button" variant="outline" onClick={exportReport} disabled={!kpis.data}>
            Export report
          </Button>
        </>
      }
    />
  )
}
