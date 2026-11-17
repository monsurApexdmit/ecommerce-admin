"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { StatusBadge } from "@/components/common/StatusBadge"
import { PayBadge, UrgentBadge } from "@/components/tailor/order-ui"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorApi, type TailorBoardOrder, type TailorDashboardData, type TailorPaymentStatus } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { KpiIcon } from "@/components/tailor/kpi-icon"
import { TAILOR_NS, stageLabel, type TailorT } from "@/components/tailor/i18n"
import { localeTag } from "@/lib/i18n"

const SUB_TONE: Record<string, string> = { muted: "text-muted-foreground", red: "text-destructive", amber: "text-dash-warn-fg", teal: "text-dash-success-fg" }
const STAGE_DOT: Record<string, string> = { new: "#7C8AA8", cutting: "#F59E0B", stitching: "#2449E8", trial: "#7C3AED", ready: "#0F766E" }
const SWATCH: Record<string, string> = {
  white: "#F4F1EA", "off-white": "#EDE6D6", beige: "#D9C7A4", cream: "#F2E8CF", black: "#1F2430", grey: "#9AA3B2", gray: "#9AA3B2", blue: "#3B5BA9", navy: "#1F2F5C",
  red: "#B42318", maroon: "#7B1E2B", green: "#2E7D5B", yellow: "#E8C547", pink: "#E8A0B4", brown: "#7A5230", purple: "#6D3FA0", orange: "#E8833A",
}

const whenTxt = (t: TailorT, d: number | null) => (d === null ? t("tailor:when.noDueDate") : d < 0 ? t("tailor:when.overdue", { days: -d }) : d === 0 ? t("tailor:when.dueToday") : d === 1 ? t("tailor:when.tomorrow") : t("tailor:when.inDays", { count: d }))
const whenCls = (d: number | null) => (d === null ? "text-muted-foreground" : d < 0 ? "text-destructive" : d <= 1 ? "text-dash-warn-fg" : "text-muted-foreground")
const fmtDate = (d: string | null, lng: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(localeTag(lng), { month: "short", day: "numeric", year: "numeric" }) : "—")

export default function TailorDashboardPage() {
  const { formatCurrency } = useCompanySettings()
  const { t, i18n } = useTranslation(TAILOR_NS)
  const blocked = useModuleGuard("TailorDashboard")
  const [data, setData] = useState<TailorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setData(await tailorApi.getDashboardData()) }
    catch (e: any) { setError(e?.response?.data?.message || t("tailor:home.couldNotLoad")) }
    finally { setLoading(false) }
  }, [t])
  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fmtKpi = (k: TailorDashboardData["kpis"][number]) => (k.kind === "money" ? formatCurrency(Number(k.value) || 0) : k.kind === "int" ? String(Math.round(Number(k.value) || 0)) : String(k.value))
  // Server sub-lines embed raw numbers for money ("1,000.00 collected"); keep as provided.

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("tailor:home.title")}
        description={t("tailor:home.description")}
        actions={<>
          <Button asChild variant="outline"><Link href="/dashboard/tailor/measurements">{t("tailor:shared.measurements")}</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/tailor/fabrics">{t("tailor:shared.fabrics")}</Link></Button>
          <Button asChild><Link href="/dashboard/tailor/orders/new">{t("tailor:shared.newTailorOrder")}</Link></Button>
        </>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-3">
            <span>{error}</span><Button type="button" variant="link" onClick={load}>{t("common:actions.retry")}</Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)}</div>
          <Skeleton className="h-[260px]" />
          <div className="grid gap-4 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px]" />)}</div>
        </>
      ) : data ? (
        <>
          <section aria-label={t("common:extra.summary")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.kpis.map((k) => (
              <StatTile
                key={k.label}
                label={k.label}
                value={fmtKpi(k)}
                icon={<KpiIcon label={k.label} />}
                hint={k.sub ? <span className={SUB_TONE[k.subTone ?? "muted"]}>{k.sub}</span> : undefined}
              />
            ))}
          </section>

          <SectionCard title={t("tailor:home.productionBoard")} actions={<span className="text-sm text-muted-foreground">{t("tailor:home.boardHint")}</span>}>
            <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              {data.board.map((col) => (
                <Card key={col.key} className="min-h-[160px] gap-2 bg-muted/50 p-2.5 shadow-none">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium"><span className="size-2 rounded-full" style={{ background: STAGE_DOT[col.key] }} />{stageLabel(t, col.key, col.label)}</span>
                    <Badge variant="secondary">{col.count}</Badge>
                  </div>
                  {col.orders.map((o) => <BoardCard key={o.id} o={o} />)}
                </Card>
              ))}
            </div>
            {!data.has_orders && (
              <p className="mt-3.5 text-sm text-muted-foreground"><Trans t={t} i18nKey="tailor:home.noOrdersBoard" components={{ link: <Link href="/dashboard/tailor/orders/new" className="font-medium text-primary underline-offset-4 hover:underline" /> }} /></p>
            )}
          </SectionCard>

          <div className="flex flex-wrap gap-4">
            <SectionCard className="flex-1 basis-[420px]" title={t("tailor:home.collectPayment")} actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/payments">{t("tailor:home.allPayments")}</Link></Button>}>
              <ItemGroup>
                {data.dues.map((d, i) => (
                  <Fragment key={d.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item size="sm" className="px-0">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="w-full truncate">{d.customer} · {d.order_no}</ItemTitle>
                        <ItemDescription className="text-xs">{stageLabel(t, d.stage, d.stage_label)}{d.phone ? ` · ${d.phone}` : ""}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="font-semibold tabular-nums text-destructive">{formatCurrency(d.due)}</span>
                        <Button asChild variant="outline" size="sm"><Link href="/dashboard/tailor/payments">{t("tailor:home.collect")}</Link></Button>
                      </ItemActions>
                    </Item>
                  </Fragment>
                ))}
              </ItemGroup>
              {data.dues.length === 0 && <EmptyState className="p-4 md:p-6" title={t("tailor:home.nothingToCollect")} description={t("tailor:home.everyOrderPaid")} />}
            </SectionCard>

            <SectionCard className="flex-1 basis-[420px]" contentClassName="flex flex-col gap-3" title={t("tailor:home.dorjiWorkload")} actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/dorjis">{t("tailor:home.manage")}</Link></Button>}>
              {data.workload.map((d) => {
                const c = d.percent >= 100 && d.open > 0 ? "#B42318" : d.percent >= 75 ? "#F59E0B" : "#0F766E"
                const bar = d.percent >= 100 && d.open > 0 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : d.percent >= 75 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-teal-700"
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-sm"><span className="font-medium">{d.name}</span><span className="font-semibold" style={{ color: c }}>{t("tailor:home.piecesOpen", { count: d.open })}</span></div>
                    <Progress value={Math.min(100, Math.max(0, d.percent))} className={cn("mt-1.5", bar)} aria-label={t("tailor:shared.workloadOf", { name: d.name })} />
                  </div>
                )
              })}
              {data.workload.length === 0 && <p className="text-sm text-muted-foreground"><Trans t={t} i18nKey="tailor:home.noDorjis" components={{ link: <Link href="/dashboard/tailor/dorjis" className="font-medium text-primary underline-offset-4 hover:underline" /> }} /></p>}
              {data.advice && <Alert><AlertDescription><p><strong>{data.advice.head}</strong> {data.advice.body}</p></AlertDescription></Alert>}
            </SectionCard>

            <SectionCard className="flex-1 basis-[300px]" contentClassName="flex flex-1 flex-col gap-2.5" title={t("tailor:home.fabricAlerts")}>
              {data.fabric_alerts.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5">
                  <span className="size-7 shrink-0 rounded-md border" style={{ background: f.hex_color || SWATCH[(f.color ?? "").toLowerCase()] || "#E3E6EE" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.name}{f.color ? ` · ${f.color}` : ""}</div>
                    <div className={cn("text-xs font-medium", f.out ? "text-destructive" : "text-dash-warn-fg")}>
                      {f.out ? t("common:extra.outOfStock") : t("tailor:home.leftReorder", { stock: f.stock, unit: f.unit ?? "", level: f.reorder_level })}
                    </div>
                  </div>
                </div>
              ))}
              {data.fabric_alerts.length === 0 && <p className="text-sm text-muted-foreground">{data.fabrics_count ? t("tailor:home.noFabricLow") : t("tailor:home.noFabrics")}</p>}
              <Button asChild variant="outline" className="mt-auto"><Link href="/dashboard/vendors/purchase-orders">{t("tailor:shared.orderFabric")}</Link></Button>
            </SectionCard>
          </div>

          <SectionCard title={t("tailor:home.recentOrders")} actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/orders">{t("tailor:home.viewAll")}</Link></Button>}>
            <ItemGroup>
              {data.recent_orders.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm" className="px-0">
                    <ItemContent className="min-w-[200px]">
                      <ItemTitle><Link href={`/dashboard/tailor/orders/${r.id}`} className="font-semibold hover:underline">{r.order_no}</Link> <span>{r.customer}</span></ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <span className="font-semibold tabular-nums">{formatCurrency(r.total)}</span>
                      <StatusBadge status={r.stage} label={stageLabel(t, r.stage, r.stage_label)} />
                      {r.payment ? <PayBadge status={r.payment as TailorPaymentStatus} /> : <Badge variant="outline">—</Badge>}
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
            {data.recent_orders.length === 0 && <EmptyState className="p-4 md:p-6" title={t("tailor:home.noOrdersYet")} />}
          </SectionCard>

          <SectionCard title={t("tailor:home.dueSoon")} actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/orders">{t("tailor:home.allOrders")}</Link></Button>}>
            <ItemGroup>
              {data.due_soon.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm" className="px-0">
                    <ItemContent className="min-w-[200px]">
                      <ItemTitle><Link href={`/dashboard/tailor/orders/${r.id}`} className="font-semibold hover:underline">{r.order_no}</Link> <span>{r.customer}</span></ItemTitle>
                      <ItemDescription className="text-xs">{r.items}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <span className="text-sm text-muted-foreground">{fmtDate(r.delivery_date, i18n.language)}</span>
                      <span className={cn("font-semibold", whenCls(r.days_left))}>{whenTxt(t, r.days_left)}</span>
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
            {data.due_soon.length === 0 && <EmptyState className="p-4 md:p-6" title={t("tailor:home.nothingDueSoon")} description={t("tailor:home.noneNext7")} />}
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

function BoardCard({ o }: { o: TailorBoardOrder }) {
  const { t } = useTranslation(TAILOR_NS)
  return (
    <Card className="gap-1.5 p-2.5">
      <div className="flex justify-between gap-1.5">
        <Link href={`/dashboard/tailor/orders/${o.id}`} className="text-xs font-semibold hover:underline">{o.order_no}</Link>
        {o.urgent && <UrgentBadge />}
      </div>
      <span className="text-sm font-medium">{o.customer}</span>
      <span className="text-xs text-muted-foreground">{o.items}</span>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{o.dorji || t("tailor:shared.notAssigned")}</span>
        <span className={cn("font-semibold", whenCls(o.days_left))}>{whenTxt(t, o.days_left)}</span>
      </div>
      <Button asChild variant="outline" size="sm"><Link href={`/dashboard/tailor/orders/${o.id}`}>{t("tailor:home.openOrder")}</Link></Button>
    </Card>
  )
}
