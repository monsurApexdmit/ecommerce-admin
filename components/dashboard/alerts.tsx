"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ageLabel, compactMoney, currencySymbol, monthName } from "./format"
import { Bar, SectionError } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

interface AlertCard {
  key: string
  count: string
  title: string
  sub: string
  cta: string
  href: string
  tone: "default" | "secondary" | "destructive" | "outline"
}

const CLEAR = "outline" as const

export function Alerts() {
  const { t, i18n } = useTranslation(["dashboard", "common"])
  const { formatCurrency } = useCompanySettings()
  const symbol = currencySymbol(formatCurrency)
  const { data, loading, error, retry } = useDashboardSection("alerts")

  if (error && !data) return <SectionError message={error} onRetry={retry} />
  if (loading && !data) {
    return (
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {[0, 1, 2].map((i) => <Bar key={i} className="h-[68px]" />)}
      </div>
    )
  }
  if (!data) return null

  const pending = data.pendingOrders.count
  const { outOfStock, belowReorder } = data.stock
  const s = data.salaries
  const salaryDue = s.unpaid > 0
  const paidPct = s.budget > 0 ? Math.round((s.paid / s.budget) * 100) : 0
  const payslips = s.payslips ?? 0

  const cards: AlertCard[] = [
    {
      key: "pending",
      count: String(pending),
      title: t("dashboard:alerts.pendingTitle"),
      sub: pending
        ? t("dashboard:alerts.pendingOldest", { age: ageLabel(data.pendingOrders.oldestOrderTime, t) })
        : t("dashboard:alerts.noPending"),
      cta: pending ? t("dashboard:alerts.review") : t("common:actions.view"),
      href: "/dashboard/orders?status=Pending",
      tone: pending ? "secondary" : CLEAR,
    },
    {
      key: "stock",
      count: String(outOfStock > 0 ? outOfStock : belowReorder),
      title: outOfStock > 0 ? t("dashboard:alerts.outOfStock") : t("dashboard:alerts.belowReorder"),
      sub:
        outOfStock > 0
          ? belowReorder > 0 ? t("dashboard:alerts.moreBelowReorder", { count: belowReorder }) : t("dashboard:alerts.restockHint")
          : belowReorder > 0 ? t("dashboard:alerts.restockHint") : t("dashboard:alerts.allStocked"),
      cta: outOfStock + belowReorder > 0 ? t("dashboard:alerts.restock") : t("common:actions.view"),
      href: "/dashboard/inventory?stock=attention",
      tone: outOfStock > 0 ? "destructive" : belowReorder > 0 ? "secondary" : CLEAR,
    },
    {
      key: "salary",
      count: salaryDue ? compactMoney(s.unpaid, symbol) : "0",
      title: salaryDue
        ? t("dashboard:alerts.salariesUnpaid", { month: monthName(s.month, i18n.language) })
        : t("dashboard:alerts.salariesPaid"),
      sub: salaryDue
        ? [
            s.daysLeft >= 0
              ? t("dashboard:alerts.dueIn", { count: s.daysLeft })
              : t("dashboard:alerts.overdue", { count: Math.abs(s.daysLeft) }),
            t("dashboard:alerts.paidPct", { pct: paidPct }),
            t("dashboard:alerts.payslips", { count: payslips }),
          ].join(" · ")
        : t("dashboard:alerts.nothingDue"),
      cta: salaryDue ? t("dashboard:alerts.pay") : t("common:actions.view"),
      href: "/dashboard/staff/salary",
      tone: salaryDue ? "default" : CLEAR,
    },
  ]

  return (
    <section aria-label={t("dashboard:alerts.label")} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
      {cards.map((c) => (
        <Link key={c.key} href={c.href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full flex-row items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-accent/50">
            <Badge variant={c.tone} className="h-10 min-w-10 shrink-0 px-2 text-sm font-semibold">
              {c.count}
            </Badge>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{c.title}</span>
              <span className="text-xs text-muted-foreground">{c.sub}</span>
            </span>
            <span className="ml-auto whitespace-nowrap text-sm font-medium">{c.cta} →</span>
          </Card>
        </Link>
      ))}
    </section>
  )
}
