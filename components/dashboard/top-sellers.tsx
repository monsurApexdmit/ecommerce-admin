"use client"

import { Trans, useTranslation } from "react-i18next"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

export function TopSellers() {
  const { t } = useTranslation(["dashboard", "common"])
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
        {data.items.length === 0 && <EmptyNote>{t("dashboard:revenue.noSales")}</EmptyNote>}
        {data.items.map((item) => (
          <div key={`${item.productId}-${item.name}`} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{item.name}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(item.revenue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={Math.round((item.revenue / max) * 100)} aria-label={t("dashboard:top.share", { name: item.name })} className="h-1.5 flex-1" />
              <span className="min-w-16 whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums">{t("dashboard:top.sold", { units: item.units })}</span>
            </div>
          </div>
        ))}
        {data.slowMovers.skus > 0 && (
          <Alert role="status" className="mt-1.5">
            <AlertDescription className="text-xs">
              <p>
                <Trans
                  t={t}
                  i18nKey="dashboard:top.slowMovers"
                  values={{ skus: data.slowMovers.skus, value: formatCurrency(data.slowMovers.value) }}
                  components={{ b: <strong className="text-foreground" /> }}
                />
              </p>
            </AlertDescription>
          </Alert>
        )}
      </>
    )
  }

  return (
    <DashCard className="flex flex-col gap-3.5">
      <CardTitle title={t("dashboard:top.title")} subtitle={t("dashboard:top.subtitle")} />
      {body()}
    </DashCard>
  )
}
