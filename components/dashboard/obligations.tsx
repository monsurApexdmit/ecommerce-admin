"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StatTile } from "@/components/common/StatTile"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useDashboardFilters } from "./dashboard-context"
import type { RangePreset } from "./dashboard-context"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const PERIOD_LABEL: Record<RangePreset, string> = { today: "today", "7d": "last 7 days", "30d": "last 30 days", year: "this year" }

export function Obligations() {
  const { preset } = useDashboardFilters()
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("obligations")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const s = data.salaries
    const rows = [
      {
        label: "Staff salaries",
        value: formatCurrency(s.budget),
        sub: `${s.month.split(" ")[0]} payroll`,
        status: s.budget > 0 ? `${formatCurrency(s.paid)} paid` : "Not generated",
        pct: s.budget > 0 ? Math.round((s.paid / s.budget) * 100) : 0,
      },
      {
        label: "Vendor payments",
        value: formatCurrency(data.vendors.due),
        sub: `${data.vendors.vendorCount} vendor${data.vendors.vendorCount === 1 ? "" : "s"} · ${data.vendors.orders} open PO`,
        status: data.vendors.due > 0 ? "Payment due" : "Nothing due",
        pct: data.vendors.totalOrdered > 0 ? Math.round((data.vendors.totalPaid / data.vendors.totalOrdered) * 100) : 100,
      },
      {
        label: "Customer receivables",
        value: formatCurrency(data.receivables.due),
        sub: `${data.receivables.openInvoices} open invoice${data.receivables.openInvoices === 1 ? "" : "s"}`,
        status: data.receivables.due > 0 ? "Outstanding" : "All collected",
        pct: data.receivables.salesTotal > 0
          ? Math.max(0, Math.min(100, Math.round((1 - data.receivables.due / data.receivables.salesTotal) * 100)))
          : 100,
      },
      {
        label: `Expenses (${s.month.split(" ")[0]})`,
        value: formatCurrency(data.expenses.amount),
        sub: `${data.expenses.count} logged this month`,
        status: data.expenses.count > 0 ? "Logged" : "None logged",
        pct: data.expenses.count > 0 ? 100 : 0,
      },
    ]

    return (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile className="gap-1 p-3.5 shadow-none" label={`Cash in · ${PERIOD_LABEL[preset]}`} value={formatCurrency(data.cashIn)} />
          <StatTile className="gap-1 p-3.5 shadow-none" label="Due this month" value={formatCurrency(data.dueThisMonth)} />
        </div>
        <div className="divide-y">
          {rows.map((o) => (
            <div key={o.label} className="flex flex-col gap-1.5 py-2.5">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="font-semibold tabular-nums">{o.value}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>{o.sub}</span>
                <span>{o.status}</span>
              </div>
              <Progress value={o.pct} aria-label={o.label} className="h-1.5" />
            </div>
          ))}
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard/staff/salary">
            Run payroll for {s.month.split(" ")[0]}
          </Link>
        </Button>
      </>
    )
  }

  return (
    <DashCard className="flex flex-col gap-3.5">
      <CardTitle title="Cash & obligations" />
      {body()}
    </DashCard>
  )
}
