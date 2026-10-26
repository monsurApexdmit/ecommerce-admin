"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { Separator } from "@/components/ui/separator"
import { bucketLabel, compactMoney, currencySymbol, niceAxis, wholeMoney } from "./format"
import { useDashboardFilters } from "./dashboard-context"
import type { RangePreset } from "./dashboard-context"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const CHART_H = 190

const RANGE_SUBTITLE: Record<RangePreset, string> = {
  today: "Hourly, today",
  "7d": "Daily, last 7 days",
  "30d": "Daily, last 30 days",
  year: `Monthly, ${new Date().getFullYear()}`,
}

/** "2026-10-25" -> "25 Oct" */
function dayMonthLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`
}

export function RevenueChart() {
  const { formatCurrency } = useCompanySettings()
  const symbol = currencySymbol(formatCurrency)
  const { preset } = useDashboardFilters()
  // "This year" shows all 12 months, including the ones still to come
  const { data, loading, error, retry } = useDashboardSection("revenue", preset === "year" ? { to: `${new Date().getFullYear()}-12-31` } : undefined)
  const money = (n: number) => wholeMoney(formatCurrency, n)

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const { max, step } = niceAxis(Math.max(0, ...data.buckets.map((b) => Math.max(b.revenue, b.grossProfit))))
    const ticks = [3, 2, 1, 0].map((k) => compactMoney(step * k, symbol))
    const hasData = data.buckets.some((b) => b.revenue > 0)
    const manyBuckets = data.buckets.length > 14
    const f = data.footer

    return (
      <>
        <div className="mt-5 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-2" style={{ minWidth: Math.max(520, data.buckets.length * 26) }}>
            <div className="flex h-[220px] flex-col justify-between pb-[22px] text-right text-[11px] text-dash-muted tabular-nums" aria-hidden>
              {ticks.map((t, i) => <span key={i}>{t}</span>)}
            </div>
            <div
              className="grid h-[220px] flex-1 gap-2 border-b border-dash-border"
              style={{
                gridTemplateColumns: `repeat(${data.buckets.length}, minmax(0, 1fr))`,
                backgroundImage: "linear-gradient(var(--dash-border-soft) 1px, transparent 1px)",
                backgroundSize: "100% 66px",
              }}
              role="img"
              aria-label={`Revenue and gross profit by ${data.bucket}`}
            >
              {data.buckets.map((b, i) => (
                <div key={b.key} className="flex h-[220px] flex-col items-center justify-end gap-1.5">
                  <div className="flex items-end gap-[3px]" style={{ height: CHART_H }}>
                    <div
                      title={`${bucketLabel(b.key, data.bucket)} · Revenue ${formatCurrency(b.revenue)}`}
                      className="w-3 rounded-t bg-dash-accent sm:w-3.5"
                      style={{ height: Math.max(2, Math.round((b.revenue / max) * CHART_H)) }}
                    />
                    <div
                      title={`${bucketLabel(b.key, data.bucket)} · Gross profit ${formatCurrency(b.grossProfit)}`}
                      className="w-3 rounded-t bg-dash-warn sm:w-3.5"
                      style={{ height: Math.max(2, Math.round((b.grossProfit / max) * CHART_H)) }}
                    />
                  </div>
                  <span className="h-4 text-[11px] text-dash-muted">
                    {manyBuckets && i % Math.ceil(data.buckets.length / 10) !== 0 ? "" : bucketLabel(b.key, data.bucket)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {!hasData && <div className="mt-3"><EmptyNote>No sales in this period.</EmptyNote></div>}
        <Separator className="mt-5" />
        <dl className="grid gap-3 pt-4 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {[
            ["Avg order value", formatCurrency(f.aov)],
            ["Gross margin", f.grossMarginPct !== null ? `${f.grossMarginPct}%` : "—"],
            ["Returns rate", f.returnsRatePct !== null ? `${f.returnsRatePct}%` : "—"],
            ["Discounts given", formatCurrency(f.discounts)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </>
    )
  }

  return (
    <DashCard className="flex-[2_1_560px]">
      <CardTitle
        title="Revenue & gross profit"
        subtitle={
          data
            ? `${RANGE_SUBTITLE[preset]}${
                data.best
                  ? ` · Best ${data.bucket === "hour" ? "hour" : data.bucket === "month" ? "month" : "day"} ${
                      data.bucket === "day" ? dayMonthLabel(data.best.key) : bucketLabel(data.best.key, data.bucket)
                    } (${money(data.best.revenue)})`
                  : " · No sales in this period"
              }`
            : undefined
        }
        action={
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dash-accent" aria-hidden />Revenue</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dash-warn" aria-hidden />Gross profit</span>
          </div>
        }
      />
      {body()}
    </DashCard>
  )
}
