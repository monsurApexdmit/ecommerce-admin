"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ageLabel, compactMoney, currencySymbol } from "./format"
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
      title: "Orders waiting to be confirmed",
      sub: pending ? `Oldest placed ${ageLabel(data.pendingOrders.oldestOrderTime)} ago` : "No pending orders",
      cta: pending ? "Review" : "View",
      href: "/dashboard/orders?status=Pending",
      tone: pending ? "secondary" : CLEAR,
    },
    {
      key: "stock",
      count: String(outOfStock > 0 ? outOfStock : belowReorder),
      title: outOfStock > 0 ? "Products out of stock" : "Products below reorder point",
      sub:
        outOfStock > 0
          ? belowReorder > 0 ? `${belowReorder} more below reorder point` : "Restock to avoid lost sales"
          : belowReorder > 0 ? "Restock to avoid lost sales" : "All stocked",
      cta: outOfStock + belowReorder > 0 ? "Restock" : "View",
      href: "/dashboard/inventory?stock=attention",
      tone: outOfStock > 0 ? "destructive" : belowReorder > 0 ? "secondary" : CLEAR,
    },
    {
      key: "salary",
      count: salaryDue ? compactMoney(s.unpaid, symbol) : "0",
      title: salaryDue ? `${s.month.split(" ")[0]} salaries unpaid` : "Salaries all paid",
      sub: salaryDue
        ? `${s.daysLeft >= 0 ? `Due in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}` : `${Math.abs(s.daysLeft)} days overdue`} · ${paidPct}% paid · ${payslips} payslip${payslips === 1 ? "" : "s"}`
        : "Nothing due",
      cta: salaryDue ? "Pay" : "View",
      href: "/dashboard/staff/salary",
      tone: salaryDue ? "default" : CLEAR,
    },
  ]

  return (
    <section aria-label="Needs attention" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
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
