"use client"

import Link from "next/link"
import { ageLabel } from "./format"
import { CardTitle, DashCard, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const LABEL = { pending: "Pending", confirmed: "Confirmed", packed: "Packed", shipped: "Shipped", delivered: "Delivered" } as const
const COLOR = {
  pending: "bg-dash-warn",
  confirmed: "bg-dash-accent",
  packed: "bg-dash-accent",
  shipped: "bg-dash-accent",
  delivered: "bg-dash-success",
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
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold text-dash-ink">{LABEL[s.key]}</span>
              <span className="text-dash-muted tabular-nums">{s.count} orders</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-dash-neutral-soft">
              <div className={`h-full rounded-full ${COLOR[s.key]}`} style={{ width: `${Math.round((s.count / max) * 100)}%`, minWidth: s.count > 0 ? 8 : 0 }} />
            </div>
          </div>
        ))}
        {bottleneck ? (
          <div className="mt-auto rounded-[10px] bg-dash-warn-soft p-3.5 text-[13px] leading-snug text-dash-warn-fg">
            <strong>Bottleneck:</strong> {bottleneck}
          </div>
        ) : (
          <div className="mt-auto rounded-[10px] bg-dash-success-soft p-3.5 text-[13px] text-dash-success-fg">
            {data.open > 0 ? "Nothing is stuck in Pending — keep moving orders along." : "No open orders — nothing is waiting on you."}
          </div>
        )}
        <Link
          href={pending > 0 ? "/dashboard/orders?status=Pending" : "/dashboard/orders"}
          className="flex h-11 items-center justify-center rounded-[10px] bg-dash-ink text-sm font-semibold text-dash-bg"
        >
          {pending > 0 ? "Process pending orders" : "View all orders"}
        </Link>
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
