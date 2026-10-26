"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const SEGMENTS = [
  { key: "healthy", label: "Healthy", color: "var(--dash-success)" },
  { key: "low", label: "Low stock", color: "var(--dash-warn)" },
  { key: "out", label: "Out of stock", color: "var(--dash-danger)" },
  { key: "overstock", label: "Overstock", color: "var(--dash-neutral)" },
] as const

export function StockHealth() {
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("stock-health")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const total = Object.values(data.segments).reduce((a, b) => a + b, 0) || 1
    const metrics = [
      { label: "Inventory turnover", value: data.turnover !== null ? `${data.turnover}×` : "—", hint: data.turnover !== null ? "per year" : "needs sales with cost data" },
      { label: "Days of inventory", value: data.daysOfInventory !== null ? `${data.daysOfInventory} days` : "—", hint: "target under 90" },
      { label: "Sell-through", value: data.sellThroughPct !== null ? `${data.sellThroughPct}%` : "—", hint: "last 30 days" },
      { label: "Dead stock", value: formatCurrency(data.deadStock.value), hint: `${data.deadStock.skus} SKUs, no sale in 90 days` },
    ]

    return (
      <>
        <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img"
          aria-label={SEGMENTS.map((s) => `${s.label} ${data.segments[s.key]}`).join(", ")}>
          {SEGMENTS.map((s) => (
            <div key={s.key} style={{ width: `${(data.segments[s.key] / total) * 100}%`, background: s.color }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {SEGMENTS.map((s) => (
            <Card key={s.key} className="gap-1 p-3 shadow-none">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="text-xl font-semibold tabular-nums">{data.segments[s.key]}</span>
            </Card>
          ))}
        </div>
        <Separator />
        <dl className="grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{m.value}</dd>
              <span className="text-[11px] text-muted-foreground">{m.hint}</span>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-muted-foreground">Overstock: {data.overstockRule.toLowerCase()}.</p>
      </>
    )
  }

  return (
    <DashCard className="flex flex-[1_1_320px] flex-col gap-[18px]">
      <CardTitle
        title="Stock health"
        subtitle={data ? `${data.skus} SKUs · ${data.units.toLocaleString()} units on hand` : undefined}
      />
      {body()}
    </DashCard>
  )
}
