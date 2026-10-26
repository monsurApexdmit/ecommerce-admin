"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ageLabel } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const LABEL = { pending: "Pending", confirmed: "Confirmed", packed: "Packed", shipped: "Shipped", delivered: "Delivered" } as const
/** Indicator colour per stage (data colour on the shadcn Progress bar). */
const COLOR = {
  pending: "[&>[data-slot=progress-indicator]]:bg-dash-warn",
  confirmed: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  packed: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  shipped: "[&>[data-slot=progress-indicator]]:bg-dash-accent",
  delivered: "[&>[data-slot=progress-indicator]]:bg-dash-success",
} as const

export function Pipeline() {
  const { data, loading, error, retry } = useDashboardSection("pipeline")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null

    const max = Math.max(1, ...data.stages.map((s) => s.count))
    const count = (k: string) => data.stages.find((s) => s.key === k)?.count ?? 0
    const pending = count("pending")
    const wait = ageLabel(data.oldestPendingTime)
    const bottleneck =
      pending === 0
        ? ""
        : `${pending === data.open
            ? `all ${data.open} open order${data.open === 1 ? " is" : "s are"} stuck in Pending.`
            : `${pending} order${pending === 1 ? " is" : "s are"} waiting in Pending.`} Oldest waiting ${wait}. Confirm and pack to start shipping.`

    return (
      <>
        {data.stages.map((s) => (
          <div key={s.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{LABEL[s.key]}</span>
              <span className="text-muted-foreground tabular-nums">{s.count} orders</span>
            </div>
            <Progress
              value={Math.round((s.count / max) * 100)}
              aria-label={`${LABEL[s.key]}: ${s.count} orders`}
              className={cn("h-2.5 bg-muted", COLOR[s.key])}
            />
          </div>
        ))}
        {bottleneck ? (
          <Alert role="status" className="mt-auto">
            <AlertDescription>
              <p><strong className="text-foreground">Bottleneck:</strong> {bottleneck}</p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="status" className="mt-auto">
            <AlertDescription>
              {data.open > 0 ? "Nothing is stuck in Pending — keep moving orders along." : "No open orders — nothing is waiting on you."}
            </AlertDescription>
          </Alert>
        )}
        <Button asChild className="w-full">
          <Link href={pending > 0 ? "/dashboard/orders?status=Pending" : "/dashboard/orders"}>
            {pending > 0 ? "Process pending orders" : "View all orders"}
          </Link>
        </Button>
      </>
    )
  }

  const shipped = data?.stages.find((s) => s.key === "shipped")?.count ?? 0
  return (
    <DashCard className="flex flex-[1_1_320px] flex-col gap-4">
      <CardTitle
        title="Fulfillment pipeline"
        subtitle={data ? `${data.open} open order${data.open === 1 ? "" : "s"}${shipped ? ` · ${shipped} shipped` : " · none shipped yet"}` : undefined}
      />
      {body()}
    </DashCard>
  )
}
