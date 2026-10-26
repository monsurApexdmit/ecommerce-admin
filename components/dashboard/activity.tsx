"use client"

import { relativeTime } from "./format"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const DOT: Record<string, string> = {
  sale: "bg-dash-accent",
  order: "bg-dash-accent",
  order_placed: "bg-dash-accent",
  order_status_changed: "bg-dash-accent",
  purchase: "bg-dash-success",
  payment: "bg-dash-success",
  expense: "bg-dash-neutral",
  stock_alert: "bg-dash-warn",
  low_stock: "bg-dash-warn",
  support: "bg-dash-danger",
  system: "bg-dash-neutral",
}

export function Activity() {
  const { data, loading, error, retry } = useDashboardSection("activity", { limit: 8 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <EmptyNote>No activity yet.</EmptyNote>
    return (
      <ul>
        {data.items.map((a, i) => (
          <li key={`${a.createdAt}-${i}`} className="flex gap-3 py-2.5">
            <span className={`mt-[5px] size-2.5 shrink-0 rounded-full ${DOT[a.type] ?? "bg-dash-danger"}`} aria-hidden />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] leading-snug text-dash-ink">{a.text}</span>
              <span className="text-xs text-dash-muted">{relativeTime(a.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <DashCard className="flex-[1_1_320px]">
      <CardTitle title="Activity" subtitle="Sales, purchases, expenses and alerts" />
      <div className="mt-2">{body()}</div>
    </DashCard>
  )
}
