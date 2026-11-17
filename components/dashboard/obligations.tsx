"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StatTile } from "@/components/common/StatTile"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { PERIOD_INLINE_LABELS, useDashboardFilters } from "./dashboard-context"
import { monthName, wholeMoney } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

export function Obligations() {
  const { t, i18n } = useTranslation(["dashboard", "common"])
  const { preset } = useDashboardFilters()
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("obligations")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const s = data.salaries
    const month = monthName(s.month, i18n.language)
    const rows = [
      {
        label: t("dashboard:obligations.staffSalaries"),
        value: formatCurrency(s.budget),
        sub: t("dashboard:obligations.payroll", { month }),
        status: s.budget > 0 ? t("dashboard:obligations.paidAmount", { amount: formatCurrency(s.paid) }) : t("dashboard:obligations.notGenerated"),
        pct: s.budget > 0 ? Math.round((s.paid / s.budget) * 100) : 0,
      },
      {
        label: t("dashboard:obligations.vendorPayments"),
        value: formatCurrency(data.vendors.due),
        sub: t("dashboard:obligations.vendorsSub", {
          vendors: t("dashboard:counts.vendors", { count: data.vendors.vendorCount }),
          orders: data.vendors.orders,
        }),
        status: data.vendors.due > 0 ? t("dashboard:obligations.paymentDue") : t("dashboard:obligations.nothingDue"),
        pct: data.vendors.totalOrdered > 0 ? Math.round((data.vendors.totalPaid / data.vendors.totalOrdered) * 100) : 100,
      },
      {
        label: t("dashboard:obligations.customerReceivables"),
        value: formatCurrency(data.receivables.due),
        sub: t("dashboard:counts.openInvoices", { count: data.receivables.openInvoices }),
        status: data.receivables.due > 0 ? t("dashboard:obligations.outstanding") : t("dashboard:obligations.allCollected"),
        pct: data.receivables.salesTotal > 0
          ? Math.max(0, Math.min(100, Math.round((1 - data.receivables.due / data.receivables.salesTotal) * 100)))
          : 100,
      },
      {
        label: t("dashboard:obligations.expenses", { month }),
        value: formatCurrency(data.expenses.amount),
        sub: t("dashboard:obligations.loggedThisMonth", { logged: data.expenses.count }),
        status: data.expenses.count > 0 ? t("dashboard:obligations.logged") : t("dashboard:obligations.noneLogged"),
        pct: data.expenses.count > 0 ? 100 : 0,
      },
    ]

    return (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile className="gap-1 p-3.5 shadow-none" label={t("dashboard:obligations.cashIn", { period: t(PERIOD_INLINE_LABELS[preset]) })} value={formatCurrency(data.cashIn)} />
          <StatTile className="gap-1 p-3.5 shadow-none" label={t("dashboard:obligations.dueThisMonth")} value={formatCurrency(data.dueThisMonth)} />
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
            {t("dashboard:obligations.runPayroll", { month })}
          </Link>
        </Button>
      </>
    )
  }

  return (
    <DashCard className="flex flex-col gap-3.5">
      <CardTitle title={t("dashboard:obligations.title")} />
      {body()}
    </DashCard>
  )
}
