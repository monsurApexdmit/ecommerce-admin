"use client"

import { useTranslation } from "react-i18next"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const SEGMENTS = [
  { key: "healthy", label: "dashboard:stock.healthy", color: "var(--dash-success)" },
  { key: "low", label: "dashboard:stock.low", color: "var(--dash-warn)" },
  { key: "out", label: "dashboard:stock.out", color: "var(--dash-danger)" },
  { key: "overstock", label: "dashboard:stock.overstock", color: "var(--dash-neutral)" },
] as const

export function StockHealth() {
  const { t } = useTranslation(["dashboard", "common"])
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("stock-health")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const total = Object.values(data.segments).reduce((a, b) => a + b, 0) || 1
    const metrics = [
      { label: t("dashboard:stock.turnover"), value: data.turnover !== null ? `${data.turnover}×` : "—", hint: data.turnover !== null ? t("dashboard:stock.perYear") : t("dashboard:stock.needsCost") },
      { label: t("dashboard:stock.daysOfInventory"), value: data.daysOfInventory !== null ? t("dashboard:counts.days", { count: data.daysOfInventory }) : "—", hint: t("dashboard:stock.target") },
      { label: t("dashboard:stock.sellThrough"), value: data.sellThroughPct !== null ? `${data.sellThroughPct}%` : "—", hint: t("dashboard:stock.last30") },
      { label: t("dashboard:stock.deadStock"), value: formatCurrency(data.deadStock.value), hint: t("dashboard:stock.deadStockHint", { skus: data.deadStock.skus }) },
    ]

    return (
      <>
        <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img"
          aria-label={SEGMENTS.map((s) => `${t(s.label)} ${data.segments[s.key]}`).join(", ")}>
          {SEGMENTS.map((s) => (
            <div key={s.key} style={{ width: `${(data.segments[s.key] / total) * 100}%`, background: s.color }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {SEGMENTS.map((s) => (
            <Card key={s.key} className="gap-1 p-3 shadow-none">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                {t(s.label)}
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
        <p className="text-[11px] text-muted-foreground">{t("dashboard:stock.overstockRule", { rule: data.overstockRule.toLowerCase() })}</p>
      </>
    )
  }

  return (
    <DashCard className="flex flex-[1_1_320px] flex-col gap-[18px]">
      <CardTitle
        title={t("dashboard:stock.title")}
        subtitle={data ? t("dashboard:stock.subtitle", { skus: data.skus, units: data.units.toLocaleString() }) : undefined}
      />
      {body()}
    </DashCard>
  )
}
