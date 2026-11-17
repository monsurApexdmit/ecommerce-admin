"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ReorderItem } from "@/lib/dashboard/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

function CoverBadge({ item }: { item: ReorderItem }) {
  const { t } = useTranslation(["dashboard", "common"])
  if (item.onHand <= 0) {
    return <Badge variant="destructive">{t("dashboard:reorder.out")}</Badge>
  }
  if (item.daysOfCover === null) {
    return <Badge variant="outline">{t("dashboard:reorder.noSales")}</Badge>
  }
  return <Badge variant={item.daysOfCover < 7 ? "secondary" : "outline"}>{t("dashboard:counts.days", { count: item.daysOfCover })}</Badge>
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
  const { t } = useTranslation(["dashboard", "common"])
  const { data, loading, error, retry } = useDashboardSection("reorder", { limit: 8 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <div className="mt-4"><EmptyNote>{t("dashboard:reorder.empty")}</EmptyNote></div>

    const anyDefault = data.items.some((i) => i.leadTimeIsDefault)
    return (
      <>
        <div className="mt-4 overflow-x-auto">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("common:fields.product")}</TableHead>
                <TableHead scope="col" className="text-right">{t("dashboard:reorder.onHand")}</TableHead>
                <TableHead scope="col" className="text-right">{t("dashboard:reorder.sellsPerDay")}</TableHead>
                <TableHead scope="col">{t("dashboard:reorder.daysOfCover")}</TableHead>
                <TableHead scope="col" className="text-right">{t("dashboard:reorder.orderQty")}</TableHead>
                <TableHead scope="col">{t("dashboard:reorder.supplier")}</TableHead>
                <TableHead scope="col"><span className="sr-only">{t("dashboard:reorder.action")}</span></TableHead>
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
                    <WithTooltip content={r.basis === "velocity" ? t("dashboard:reorder.qtyVelocity", { lead: r.leadTimeDays, safety: r.safetyDays ?? data.defaults.safetyDays }) : t("dashboard:reorder.qtyReorderPoint")}>
                      <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">{r.suggestedQty}</span>
                    </WithTooltip>
                  </TableCell>
                  <TableCell>
                    {r.vendorName ?? <span className="italic">{t("dashboard:reorder.noSupplier")}</span>}
                    {r.vendorName && (
                      <div className="text-[11px]">
                        {t(r.leadTimeIsDefault ? "dashboard:reorder.leadDefault" : "dashboard:reorder.lead", { days: r.leadTimeDays })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        aria-label={t("dashboard:reorder.createPoFor", { name: r.name })}
                        href={poTarget([r]).href}
                      >
                        {t("dashboard:reorder.createPo")}
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
            {t("dashboard:reorder.defaultsNote", { lead: data.defaults.leadTimeDays, safety: data.defaults.safetyDays })}
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
        title={t("dashboard:reorder.title")}
        subtitle={t("dashboard:reorder.subtitle")}
        action={
          count > 0 && data ? (
            <Button asChild>
              <Link href={target!.href}>
                {t("dashboard:reorder.createPoCount", { count })}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {body()}
    </DashCard>
  )
}
