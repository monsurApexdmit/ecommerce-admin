"use client"

import Link from "next/link"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ageDays, ageLabel } from "./format"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const CHANNEL: Record<string, string> = { pos: "In-store POS", storefront: "Online store", online: "Online store", cod: "Cash on delivery", manual: "Manual" }
const STATUS_TONE: Record<string, string> = {
  Pending: "bg-dash-warn-soft text-dash-warn-fg",
  Processing: "bg-dash-accent-soft text-dash-accent-fg",
  Packed: "bg-dash-accent-soft text-dash-accent-fg",
  Shipped: "bg-dash-accent-soft text-dash-accent-fg",
  Delivered: "bg-dash-success-soft text-dash-success-fg",
  Completed: "bg-dash-success-soft text-dash-success-fg",
  Cancelled: "bg-dash-danger-soft text-dash-danger-fg",
}

function paymentTone(status: string) {
  if (status === "paid") return "bg-dash-success-soft text-dash-success-fg"
  if (status === "refunded" || status === "failed") return "bg-dash-danger-soft text-dash-danger-fg"
  return "bg-dash-warn-soft text-dash-warn-fg"
}
const paymentLabel = (s: string) => (s === "paid" ? "Paid" : s === "partially_paid" ? "Partial" : s === "pending" ? "Unpaid" : s.charAt(0).toUpperCase() + s.slice(1))

export function RecentOrders() {
  const { formatCurrency } = useCompanySettings()
  const { data, loading, error, retry } = useDashboardSection("recent-orders", { limit: 6 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <div className="mt-3"><EmptyNote>No orders yet.</EmptyNote></div>
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              {["Invoice", "Customer", "Channel", "Payment", "Amount", "Status", "Age"].map((h) => (
                <th key={h} scope="col" className={`th-label border-b border-dash-border px-2 py-2.5 ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => {
              const days = ageDays(o.orderTime)
              const open = !["Delivered", "Completed", "Cancelled"].includes(o.status)
              const ageTone = !open || days < 1 ? "text-dash-neutral-fg" : days >= 3 ? "text-dash-danger" : "text-dash-warn-fg"
              return (
                <tr key={o.id}>
                  <td className="border-b border-dash-border-soft px-2 py-3 font-semibold text-dash-ink">#{o.invoiceNo}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-dash-ink">{o.customerName}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{CHANNEL[o.channel] ?? o.channel} · {o.method}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3">
                    <span className={`rounded-md px-2 py-[3px] text-xs font-semibold ${paymentTone(o.paymentStatus)}`}>{paymentLabel(o.paymentStatus)}</span>
                  </td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold text-dash-ink tabular-nums">{formatCurrency(o.amount)}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3">
                    <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${STATUS_TONE[o.status] ?? "bg-dash-neutral-soft text-dash-neutral-fg"}`}>{o.status === "Processing" ? "Confirmed" : o.status}</span>
                  </td>
                  <td className={`border-b border-dash-border-soft px-2 py-3 font-semibold ${ageTone}`}>{ageLabel(o.orderTime)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <DashCard className="flex-[2_1_560px]">
      <CardTitle
        title="Recent orders"
        action={<Link href="/dashboard/orders" className="text-[13px] font-semibold text-dash-accent hover:underline">View all →</Link>}
      />
      {body()}
    </DashCard>
  )
}
