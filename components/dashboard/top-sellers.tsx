"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

export function TopSellers() {
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("top-products")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    const max = Math.max(1, ...data.items.map((i) => i.revenue))
    return (
      <>
        {data.items.length === 0 && <EmptyNote>No sales in this period.</EmptyNote>}
        {data.items.map((t) => (
          <div key={`${t.productId}-${t.name}`} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate font-semibold text-dash-ink">{t.name}</span>
              <span className="font-bold text-dash-ink tabular-nums">{formatCurrency(t.revenue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-dash-neutral-soft">
                <div className="h-full rounded-full bg-dash-accent" style={{ width: `${Math.round((t.revenue / max) * 100)}%` }} />
              </div>
              <span className="w-16 text-right text-xs text-dash-muted tabular-nums">{t.units} sold</span>
            </div>
          </div>
        ))}
        {data.slowMovers.skus > 0 && (
          <p className="mt-1.5 rounded-[10px] bg-dash-neutral-soft p-3 text-xs leading-snug text-dash-neutral-fg">
            <strong>Slow movers:</strong> {data.slowMovers.skus} SKUs worth {formatCurrency(data.slowMovers.value)} (at cost)
            haven’t sold in 90 days. Consider a bundle or clearance.
          </p>
        )}
      </>
    )
  }

  return (
    <DashCard className="flex flex-col gap-3.5">
      <CardTitle title="Top sellers" subtitle="By revenue" />
      {body()}
    </DashCard>
  )
}
