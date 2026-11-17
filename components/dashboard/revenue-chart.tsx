"use client"

import { useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Separator } from "@/components/ui/separator"
import { bucketLabel, compactMoney, currencySymbol, niceAxis, wholeMoney } from "./format"
import { useDashboardFilters } from "./dashboard-context"
import type { RangePreset } from "./dashboard-context"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const CHART_H = 190

const RANGE_SUBTITLE = {
  today: "dashboard:revenue.hourlyToday",
  "7d": "dashboard:revenue.daily7",
  "30d": "dashboard:revenue.daily30",
  year: "dashboard:revenue.monthlyYear",
} as const satisfies Record<RangePreset, string>

const BEST = { hour: "dashboard:revenue.bestHour", day: "dashboard:revenue.bestDay", month: "dashboard:revenue.bestMonth" } as const
const CHART_ARIA = { hour: "dashboard:revenue.ariaHour", day: "dashboard:revenue.ariaDay", month: "dashboard:revenue.ariaMonth" } as const

/** "2026-10-25" -> "25 Oct" */
function dayMonthLabel(key: string, lng: string): string {
  const d = new Date(`${key}T00:00:00`)
  return `${d.toLocaleString(localeTag(lng), { day: "numeric" })} ${d.toLocaleString(localeTag(lng), { month: "short" })}`
}

export function RevenueChart() {
  const { t, i18n } = useTranslation(["dashboard", "common"])
  const lng = i18n.language
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
              aria-label={t(CHART_ARIA[data.bucket])}
            >
              {data.buckets.map((b, i) => (
                <div key={b.key} className="flex h-[220px] flex-col items-center justify-end gap-1.5">
                  <div className="flex items-end gap-[3px]" style={{ height: CHART_H }}>
                    <div
                      title={t("dashboard:revenue.barRevenue", { label: bucketLabel(b.key, data.bucket, t, lng), amount: formatCurrency(b.revenue) })}
                      className="w-3 rounded-t bg-dash-accent sm:w-3.5"
                      style={{ height: Math.max(2, Math.round((b.revenue / max) * CHART_H)) }}
                    />
                    <div
                      title={t("dashboard:revenue.barProfit", { label: bucketLabel(b.key, data.bucket, t, lng), amount: formatCurrency(b.grossProfit) })}
                      className="w-3 rounded-t bg-dash-warn sm:w-3.5"
                      style={{ height: Math.max(2, Math.round((b.grossProfit / max) * CHART_H)) }}
                    />
                  </div>
                  <span className="h-4 whitespace-nowrap text-[11px] text-dash-muted">
                    {manyBuckets && i % Math.ceil(data.buckets.length / 10) !== 0 ? "" : bucketLabel(b.key, data.bucket, t, lng)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {!hasData && <div className="mt-3"><EmptyNote>{t("dashboard:revenue.noSales")}</EmptyNote></div>}
        <Separator className="mt-5" />
        <dl className="grid gap-3 pt-4 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {[
            [t("dashboard:revenue.aov"), formatCurrency(f.aov)],
            [t("dashboard:revenue.grossMargin"), f.grossMarginPct !== null ? `${f.grossMarginPct}%` : "—"],
            [t("dashboard:revenue.returnsRate"), f.returnsRatePct !== null ? `${f.returnsRatePct}%` : "—"],
            [t("dashboard:revenue.discounts"), formatCurrency(f.discounts)],
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
        title={t("dashboard:revenue.title")}
        subtitle={
          data
            ? [
                t(RANGE_SUBTITLE[preset], { year: new Date().getFullYear() }),
                data.best
                  ? t(BEST[data.bucket], {
                      label: data.bucket === "day" ? dayMonthLabel(data.best.key, lng) : bucketLabel(data.best.key, data.bucket, t, lng),
                      amount: money(data.best.revenue),
                    })
                  : t("dashboard:revenue.noSalesInline"),
              ].join(" · ")
            : undefined
        }
        action={
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dash-accent" aria-hidden />{t("dashboard:revenue.revenue")}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dash-warn" aria-hidden />{t("dashboard:revenue.grossProfit")}</span>
          </div>
        }
      />
      {body()}
    </DashCard>
  )
}
