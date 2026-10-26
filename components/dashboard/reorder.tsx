"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import type { ReorderItem } from "@/lib/dashboard/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

function CoverBadge({ item }: { item: ReorderItem }) {
  if (item.onHand <= 0) {
    return <Badge variant="destructive">Out</Badge>
  }
  if (item.daysOfCover === null) {
    return <Badge variant="outline">No sales</Badge>
  }
  return <Badge variant={item.daysOfCover < 7 ? "secondary" : "outline"}>{item.daysOfCover} days</Badge>
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
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Product</TableHead>
                <TableHead scope="col" className="text-right">On hand</TableHead>
                <TableHead scope="col" className="text-right">Sells / day</TableHead>
                <TableHead scope="col">Days of cover</TableHead>
                <TableHead scope="col" className="text-right">Order qty</TableHead>
                <TableHead scope="col">Supplier</TableHead>
                <TableHead scope="col"><span className="sr-only">Action</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.onHand <= 0 && "text-destructive")}>{r.onHand}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.avgDailySales.toFixed(1)}</TableCell>
                  <TableCell><CoverBadge item={r} /></TableCell>
                  <TableCell className="text-right tabular-nums">
                    <WithTooltip content={r.basis === "velocity" ? `Sales rate × (${r.leadTimeDays}d lead + ${r.safetyDays ?? data.defaults.safetyDays}d safety) − on hand` : "Based on reorder point (no recent sales)"}>
                      <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">{r.suggestedQty}</span>
                    </WithTooltip>
                  </TableCell>
                  <TableCell>
                    {r.vendorName ?? <span className="italic">No supplier</span>}
                    {r.vendorName && <div className="text-[11px]">{r.leadTimeDays}d lead{r.leadTimeIsDefault ? " (default)" : ""}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        aria-label={`Create purchase order for ${r.name}`}
                        href={poTarget([r]).href}
                      >
                        Create PO
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {anyDefault && (
          <p className="mt-3 text-xs text-muted-foreground">
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
            <Button asChild>
              <Link href={target!.href}>
                Create PO for {count} item{count === 1 ? "" : "s"}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {body()}
    </DashCard>
  )
}
