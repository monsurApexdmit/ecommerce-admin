"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useDashboardFilters } from "./dashboard-context"
import type { RangePreset } from "./dashboard-context"
import { signedPct, wholeMoney } from "./format"
import { Bar, SectionError } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

type Tone = "up" | "down" | "flat" | "warn"

const TONE: Record<Tone, "default" | "destructive" | "outline" | "secondary"> = {
  up: "default",
  down: "destructive",
  flat: "outline",
  warn: "secondary",
}

const PERIOD_LABEL: Record<RangePreset, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", year: "This year" }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

function Sparkline({ values, color }: { values: number[] | null; color: string }) {
  // No history (or all zeros): draw a flat line, like the design, instead of leaving a gap
  const data = values && values.length >= 2 ? values : [0, 0]
  values = data
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values
    .map((v, i) => `${((i * 120) / (values.length - 1)).toFixed(1)},${(28 - ((v - min) / range) * 24).toFixed(1)}`)
    .join(" ")
  return (
    <svg viewBox="0 0 120 32" width="100%" height="32" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

interface Card {
  label: string
  value: string
  chip: string
  tone: Tone
  sub: string
  series: number[] | null
  color: string
}

export function Kpis() {
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { preset } = useDashboardFilters()
  const { data, loading, error, retry } = useDashboardSection("kpis")

  if (error && !data) return <SectionError message={error} onRetry={retry} />
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Bar key={i} className="h-[170px] rounded-xl" />)}
      </div>
    )
  }
  if (!data) return null

  const deltaTone = (d: number | null): Tone => (d === null ? "flat" : d > 0 ? "up" : d < 0 ? "down" : "flat")
  const d = data

  const cards: Card[] = [
    {
      label: "Net revenue",
      value: formatCurrency(d.revenue.value),
      chip: signedPct(d.revenue.deltaPct) ?? "—",
      tone: deltaTone(d.revenue.deltaPct),
      sub: `${PERIOD_LABEL[preset]} · ${plural(d.revenue.orders, "order")}`,
      series: d.revenue.series,
      color: "var(--dash-accent)",
    },
    {
      label: "Gross profit",
      value: d.revenue.value > 0 ? formatCurrency(d.grossProfit.value) : "–",
      chip: d.grossProfit.marginPct !== null ? `${d.grossProfit.marginPct}% margin` : "—",
      tone: d.grossProfit.marginPct === null ? "flat" : d.grossProfit.value < 0 ? "down" : d.grossProfit.marginPct > 0 ? "up" : "flat",
      sub:
        d.grossProfit.costCoveragePct !== null && d.grossProfit.costCoveragePct < 100
          ? `Cost known for ~${d.grossProfit.costCoveragePct}% of sales`
          : "Margin after cost of goods",
      series: d.grossProfit.series,
      color: "var(--dash-warn)",
    },
    {
      label: "Orders",
      value: String(d.orders.value),
      chip: `AOV ${formatCurrency(d.orders.aov)}`,
      tone: deltaTone(d.orders.deltaPct),
      sub: `${d.orders.delivered} delivered · ${d.orders.pending} pending`,
      series: d.orders.series,
      color: "var(--dash-accent)",
    },
    {
      label: "Inventory value",
      value: formatCurrency(d.inventory.valueAtCost),
      chip: "at cost",
      tone: "flat",
      sub: `${d.inventory.units.toLocaleString()} units · ${d.inventory.skus} SKUs`,
      series: null,
      color: "var(--dash-success)",
    },
    {
      label: "Receivable",
      value: formatCurrency(d.receivable.value),
      chip: `${d.receivable.overdue} overdue`,
      tone: d.receivable.overdue > 0 ? "warn" : "flat",
      sub: `${plural(d.receivable.openInvoices, "open invoice")} · ${plural(d.receivable.debtors ?? 0, "customer")}`,
      series: null,
      color: "var(--dash-neutral)",
    },
    {
      label: "Payable",
      value: formatCurrency(d.payable.value),
      chip: d.payable.value > 0 && d.payable.nextDue && !Number.isNaN(new Date(d.payable.nextDue).getTime())
        ? `due ${new Date(d.payable.nextDue).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : d.payable.value > 0 ? "due" : "clear",
      tone: d.payable.value > 0 ? "warn" : "flat",
      sub: `Salaries ${formatCurrency(d.payable.salaries)} · Vendors ${formatCurrency(d.payable.vendors)}`,
      series: null,
      color: "var(--dash-warn-fg)",
    },
  ]

  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className="min-w-0 gap-2.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{c.label}</span>
            <Badge variant={TONE[c.tone]} className="shrink-0">{c.chip}</Badge>
          </div>
          <span className="truncate text-2xl font-semibold tracking-tight tabular-nums">{c.value}</span>
          <Sparkline values={c.series} color={c.color} />
          <span className="truncate text-xs text-muted-foreground" title={typeof c.sub === "string" ? c.sub : undefined}>{c.sub}</span>
        </Card>
      ))}
    </section>
  )
}
