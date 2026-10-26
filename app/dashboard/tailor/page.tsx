"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
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

const SUB_TONE: Record<string, string> = { muted: "text-muted-foreground", red: "text-destructive", amber: "text-dash-warn-fg", teal: "text-dash-success-fg" }
const STAGE_DOT: Record<string, string> = { new: "#7C8AA8", cutting: "#F59E0B", stitching: "#2449E8", trial: "#7C3AED", ready: "#0F766E" }
const SWATCH: Record<string, string> = {
  white: "#F4F1EA", "off-white": "#EDE6D6", beige: "#D9C7A4", cream: "#F2E8CF", black: "#1F2430", grey: "#9AA3B2", gray: "#9AA3B2", blue: "#3B5BA9", navy: "#1F2F5C",
  red: "#B42318", maroon: "#7B1E2B", green: "#2E7D5B", yellow: "#E8C547", pink: "#E8A0B4", brown: "#7A5230", purple: "#6D3FA0", orange: "#E8833A",
}

const whenTxt = (d: number | null) => (d === null ? "No due date" : d < 0 ? `Overdue ${-d}d` : d === 0 ? "Due today" : d === 1 ? "Tomorrow" : `In ${d} days`)
const whenCls = (d: number | null) => (d === null ? "text-muted-foreground" : d < 0 ? "text-destructive" : d <= 1 ? "text-dash-warn-fg" : "text-muted-foreground")
const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default function TailorDashboardPage() {
  const { formatCurrency } = useCompanySettings()
  const blocked = useModuleGuard("TailorDashboard")
  const [data, setData] = useState<TailorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setData(await tailorApi.getDashboardData()) }
    catch (e: any) { setError(e?.response?.data?.message || "Could not load the tailor dashboard.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fmtKpi = (k: TailorDashboardData["kpis"][number]) => (k.kind === "money" ? formatCurrency(Number(k.value) || 0) : k.kind === "int" ? String(Math.round(Number(k.value) || 0)) : String(k.value))
  // Server sub-lines embed raw numbers for money ("1,000.00 collected"); keep as provided.

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Tailor shop"
        description="Today’s work, who is doing it, and what is due."
        actions={<>
          <Button asChild variant="outline"><Link href="/dashboard/tailor/measurements">Measurements</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/tailor/fabrics">Fabrics</Link></Button>
          <Button asChild><Link href="/dashboard/tailor/orders/new">+ New tailor order</Link></Button>
        </>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-3">
            <span>{error}</span><Button type="button" variant="link" onClick={load}>Retry</Button>
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
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

          <SectionCard title="Production board" actions={<span className="text-sm text-muted-foreground">Open an order to move it along</span>}>
            <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              {data.board.map((col) => (
                <Card key={col.key} className="min-h-[160px] gap-2 bg-muted/50 p-2.5 shadow-none">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium"><span className="size-2 rounded-full" style={{ background: STAGE_DOT[col.key] }} />{col.label}</span>
                    <Badge variant="secondary">{col.count}</Badge>
                  </div>
                  {col.orders.map((o) => <BoardCard key={o.id} o={o} />)}
                </Card>
              ))}
            </div>
            {!data.has_orders && (
              <p className="mt-3.5 text-sm text-muted-foreground">No tailor orders yet. <Link href="/dashboard/tailor/orders/new" className="font-medium text-primary underline-offset-4 hover:underline">Create the first order</Link> and it will appear on this board.</p>
            )}
          </SectionCard>

          <div className="flex flex-wrap gap-4">
            <SectionCard className="flex-1 basis-[420px]" title="Collect payment" actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/payments">All payments →</Link></Button>}>
              <ItemGroup>
                {data.dues.map((d, i) => (
                  <Fragment key={d.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item size="sm" className="px-0">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="w-full truncate">{d.customer} · {d.order_no}</ItemTitle>
                        <ItemDescription className="text-xs">{d.stage_label}{d.phone ? ` · ${d.phone}` : ""}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="font-semibold tabular-nums text-destructive">{formatCurrency(d.due)}</span>
                        <Button asChild variant="outline" size="sm"><Link href="/dashboard/tailor/payments">Collect</Link></Button>
                      </ItemActions>
                    </Item>
                  </Fragment>
                ))}
              </ItemGroup>
              {data.dues.length === 0 && <EmptyState className="p-4 md:p-6" title="Nothing to collect" description="Every order is paid up." />}
            </SectionCard>

            <SectionCard className="flex-1 basis-[420px]" contentClassName="flex flex-col gap-3" title="Dorji workload" actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/dorjis">Manage →</Link></Button>}>
              {data.workload.map((d) => {
                const c = d.percent >= 100 && d.open > 0 ? "#B42318" : d.percent >= 75 ? "#F59E0B" : "#0F766E"
                const bar = d.percent >= 100 && d.open > 0 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : d.percent >= 75 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-teal-700"
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-sm"><span className="font-medium">{d.name}</span><span className="font-semibold" style={{ color: c }}>{d.open} {d.open === 1 ? "piece" : "pieces"} open</span></div>
                    <Progress value={Math.min(100, Math.max(0, d.percent))} className={cn("mt-1.5", bar)} aria-label={`${d.name} workload`} />
                  </div>
                )
              })}
              {data.workload.length === 0 && <p className="text-sm text-muted-foreground">No dorjis yet. <Link href="/dashboard/tailor/dorjis" className="font-medium text-primary underline-offset-4 hover:underline">Add a dorji</Link> to track workload.</p>}
              {data.advice && <Alert><AlertDescription><p><strong>{data.advice.head}</strong> {data.advice.body}</p></AlertDescription></Alert>}
            </SectionCard>

            <SectionCard className="flex-1 basis-[300px]" contentClassName="flex flex-1 flex-col gap-2.5" title="Fabric alerts">
              {data.fabric_alerts.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5">
                  <span className="size-7 shrink-0 rounded-md border" style={{ background: f.hex_color || SWATCH[(f.color ?? "").toLowerCase()] || "#E3E6EE" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.name}{f.color ? ` · ${f.color}` : ""}</div>
                    <div className={cn("text-xs font-medium", f.out ? "text-destructive" : "text-dash-warn-fg")}>
                      {f.out ? "Out of stock" : `${f.stock} ${f.unit ?? ""} left (reorder at ${f.reorder_level})`}
                    </div>
                  </div>
                </div>
              ))}
              {data.fabric_alerts.length === 0 && <p className="text-sm text-muted-foreground">{data.fabrics_count ? "No fabric is running low." : "No fabrics added yet."}</p>}
              <Button asChild variant="outline" className="mt-auto"><Link href="/dashboard/vendors/purchase-orders">Order fabric</Link></Button>
            </SectionCard>
          </div>

          <SectionCard title="Recent orders" actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/orders">View all →</Link></Button>}>
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
                      <StatusBadge status={r.stage} label={r.stage_label} />
                      {r.payment ? <PayBadge status={r.payment as TailorPaymentStatus} /> : <Badge variant="outline">—</Badge>}
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
            {data.recent_orders.length === 0 && <EmptyState className="p-4 md:p-6" title="No orders yet" />}
          </SectionCard>

          <SectionCard title="Due soon" actions={<Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/orders">All orders →</Link></Button>}>
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
                      <span className="text-sm text-muted-foreground">{fmtDate(r.delivery_date)}</span>
                      <span className={cn("font-semibold", whenCls(r.days_left))}>{whenTxt(r.days_left)}</span>
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
            {data.due_soon.length === 0 && <EmptyState className="p-4 md:p-6" title="Nothing due soon" description="No orders due in the next 7 days." />}
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

function BoardCard({ o }: { o: TailorBoardOrder }) {
  return (
    <Card className="gap-1.5 p-2.5">
      <div className="flex justify-between gap-1.5">
        <Link href={`/dashboard/tailor/orders/${o.id}`} className="text-xs font-semibold hover:underline">{o.order_no}</Link>
        {o.urgent && <UrgentBadge />}
      </div>
      <span className="text-sm font-medium">{o.customer}</span>
      <span className="text-xs text-muted-foreground">{o.items}</span>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{o.dorji || "Not assigned"}</span>
        <span className={cn("font-semibold", whenCls(o.days_left))}>{whenTxt(o.days_left)}</span>
      </div>
      <Button asChild variant="outline" size="sm"><Link href={`/dashboard/tailor/orders/${o.id}`}>Open order →</Link></Button>
    </Card>
  )
}
