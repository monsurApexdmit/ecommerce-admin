"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ageLabel } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const LABEL = {
  pending: "common:orderStatus.pending",
  confirmed: "common:orderStatus.confirmed",
  packed: "dashboard:pipeline.packed",
  shipped: "common:orderStatus.shipped",
  delivered: "common:orderStatus.delivered",
} as const
/** Indicator colour per stage (data colour on the shadcn Progress bar). */
const COLOR = {
  pending: "[&>[data-slot=progress-indicator]]:bg-dash-warn",
  confirmed: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  packed: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  shipped: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  delivered: "[&>[data-slot=progress-indicator]]:bg-dash-success",
} as const

export function Pipeline() {
  const { t } = useTranslation(["dashboard", "common"])
  const { data, loading, error, retry } = useDashboardSection("pipeline")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const max = Math.max(1, ...data.stages.map((s) => s.count))
    const count = (k: string) => data.stages.find((s) => s.key === k)?.count ?? 0
    const pending = count("pending")
    const wait = ageLabel(data.oldestPendingTime, t)
    const bottleneck =
      pending === 0
        ? ""
        : `${pending === data.open
            ? t("dashboard:pipeline.allStuck", { count: data.open })
            : t("dashboard:pipeline.waiting", { count: pending })} ${t("dashboard:pipeline.oldestWaiting", { age: wait })}`

    return (
      <>
        {data.stages.map((s) => (
          <div key={s.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{t(LABEL[s.key])}</span>
              <span className="text-muted-foreground tabular-nums">{t("common:count.orders", { count: s.count })}</span>
            </div>
            <Progress
              value={Math.round((s.count / max) * 100)}
              aria-label={t("dashboard:pipeline.stageAria", { stage: t(LABEL[s.key]), orders: t("common:count.orders", { count: s.count }) })}
              className={cn("h-2.5 bg-muted", COLOR[s.key])}
            />
          </div>
        ))}
        {bottleneck ? (
          <Alert role="status" className="mt-auto">
            <AlertDescription>
              <p><strong className="text-foreground">{t("dashboard:pipeline.bottleneck")}</strong> {bottleneck}</p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="status" className="mt-auto">
            <AlertDescription>
              {data.open > 0 ? t("dashboard:pipeline.nothingStuck") : t("dashboard:pipeline.noOpen")}
            </AlertDescription>
          </Alert>
        )}
        <Button asChild className="w-full">
          <Link href={pending > 0 ? "/dashboard/orders?status=Pending" : "/dashboard/orders"}>
            {pending > 0 ? t("dashboard:pipeline.processPending") : t("dashboard:pipeline.viewAll")}
          </Link>
        </Button>
      </>
    )
  }

  const shipped = data?.stages.find((s) => s.key === "shipped")?.count ?? 0
  return (
    <DashCard className="flex flex-[1_1_320px] flex-col gap-4">
      <CardTitle
        title={t("dashboard:pipeline.title")}
        subtitle={
          data
            ? shipped
              ? t("dashboard:pipeline.subtitleShipped", { count: data.open, shipped })
              : t("dashboard:pipeline.subtitleNoneShipped", { count: data.open })
            : undefined
        }
      />
      {body()}
    </DashCard>
  )
}
