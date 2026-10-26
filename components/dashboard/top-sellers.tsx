"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
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
            <div className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{t.name}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(t.revenue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={Math.round((t.revenue / max) * 100)} aria-label={`${t.name} revenue share`} className="h-1.5 flex-1" />
              <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{t.units} sold</span>
            </div>
          </div>
        ))}
        {data.slowMovers.skus > 0 && (
          <Alert role="status" className="mt-1.5">
            <AlertDescription className="text-xs">
              <p>
                <strong className="text-foreground">Slow movers:</strong> {data.slowMovers.skus} SKUs worth {formatCurrency(data.slowMovers.value)} (at cost)
                haven’t sold in 90 days. Consider a bundle or clearance.
              </p>
            </AlertDescription>
          </Alert>
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
