"use client"

import Link from "next/link"
import type { ReorderItem } from "@/lib/dashboard/types"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

function CoverBadge({ item }: { item: ReorderItem }) {
  if (item.onHand <= 0) {
    return <span className="rounded-full bg-dash-danger-soft px-2.5 py-[3px] text-xs font-bold text-dash-danger-fg">Out</span>
  }
  if (item.daysOfCover === null) {
    return <span className="rounded-full bg-dash-neutral-soft px-2.5 py-[3px] text-xs font-bold text-dash-neutral-fg">No sales</span>
  }
  const tone = item.daysOfCover < 7 ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-neutral-soft text-dash-neutral-fg"
  return <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${tone}`}>{item.daysOfCover} days</span>
}

/** PO create link, pre-filled with the suggested items for one supplier (the first with a supplier). */
function poTarget(items: ReorderItem[]): { href: string; count: number } {
  const withQty = items.filter((i) => i.suggestedQty > 0)
  const vendorId = withQty.find((i) => i.vendorId)?.vendorId ?? null
  const chosen = vendorId ? withQty.filter((i) => i.vendorId === vendorId) : withQty
  const params = new URLSearchParams({ new: "1" })
  if (vendorId) params.set("vendorId", String(vendorId))
  params.set("items", chosen.map((i) => `${i.productId}:${i.suggestedQty}`).join(","))
  return { href: `/dashboard/vendors/purchase-orders?${params.toString()}`, count: chosen.length }
}

export function ReorderSuggestions() {
  const { data, loading, error, retry } = useDashboardSection("reorder", { limit: 8 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <div className="mt-4"><EmptyNote>Nothing needs reordering right now.</EmptyNote></div>

    const anyDefault = data.items.some((i) => i.leadTimeIsDefault)
    return (
      <>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 ">Product</th>
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 text-right ">On hand</th>
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 text-right ">Sells / day</th>
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 ">Days of cover</th>
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 text-right ">Order qty</th>
                <th scope="col" className="th-label border-b border-dash-border px-2 py-2.5 ">Supplier</th>
                <th scope="col" className="border-b border-dash-border px-2 py-2.5"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.productId}>
                  <td className="border-b border-dash-border-soft px-2 py-3">
                    <div className="font-semibold text-dash-ink">{r.name}</div>
                    {r.sku && <div className="text-xs text-dash-muted">{r.sku}</div>}
                  </td>
                  <td className={`border-b border-dash-border-soft px-2 py-3 text-right font-semibold tabular-nums ${r.onHand <= 0 ? "text-dash-danger" : "text-dash-ink"}`}>{r.onHand}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums text-dash-ink">{r.avgDailySales.toFixed(1)}</td>
                  <td className="border-b border-dash-border-soft px-2 py-3"><CoverBadge item={r} /></td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums text-dash-ink" title={r.basis === "velocity" ? `Sales rate × (${r.leadTimeDays}d lead + ${r.safetyDays ?? data.defaults.safetyDays}d safety) − on hand` : "Based on reorder point (no recent sales)"}>
                    {r.suggestedQty}
                  </td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">
                    {r.vendorName ?? <span className="italic">No supplier</span>}
                    {r.vendorName && <div className="text-[11px]">{r.leadTimeDays}d lead{r.leadTimeIsDefault ? " (default)" : ""}</div>}
                  </td>
                  <td className="border-b border-dash-border-soft px-2 py-3 text-right">
                    <Link
                      aria-label={`Create purchase order for ${r.name}`}
                      href={poTarget([r]).href}
                      className="inline-flex h-8 items-center rounded-lg border border-dash-border px-2.5 text-xs font-semibold text-dash-ink hover:bg-dash-neutral-soft"
                    >
                      Create PO
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {anyDefault && (
          <p className="mt-3 text-[11px] text-dash-muted">
            Suppliers without a lead time use a default of {data.defaults.leadTimeDays} days plus {data.defaults.safetyDays} safety days.
          </p>
        )}
      </>
    )
  }

  const target = data ? poTarget(data.items) : null
  const count = target?.count ?? 0
  return (
    <DashCard className="flex-[2_1_560px]">
      <CardTitle
        title="Smart reorder suggestions"
        subtitle="Based on 30-day sales velocity and supplier lead time"
        action={
          count > 0 && data ? (
            <Link href={target!.href} className="brand-btn !h-10 !px-3.5 !text-[13px]">
              Create PO for {count} item{count === 1 ? "" : "s"}
            </Link>
          ) : undefined
        }
      />
      {body()}
    </DashCard>
  )
}
