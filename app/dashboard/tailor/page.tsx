"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorApi, type TailorBoardOrder, type TailorDashboardData, type TailorBoardStage, type TailorTone } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { KpiIcon } from "@/components/tailor/kpi-icon"

const TONE: Record<TailorTone, string> = {
  blue: "bg-dash-accent-soft text-dash-accent-fg",
  teal: "bg-dash-success-soft text-dash-success-fg",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  amber: "bg-dash-warn-soft text-dash-warn-fg",
  red: "bg-dash-danger-soft text-dash-danger-fg",
}
const SUB_TONE: Record<string, string> = { muted: "text-dash-muted", red: "text-dash-danger-fg", amber: "text-dash-warn-fg", teal: "text-dash-success-fg" }
const STAGE_DOT: Record<string, string> = { new: "#7C8AA8", cutting: "#F59E0B", stitching: "#2449E8", trial: "#7C3AED", ready: "#0F766E" }
const STAGE_PILL: Record<TailorBoardStage, string> = {
  new: "bg-dash-neutral-soft text-dash-neutral-fg", cutting: "bg-dash-warn-soft text-dash-warn-fg", stitching: "bg-dash-accent-soft text-dash-accent-fg",
  trial: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300", ready: "bg-dash-success-soft text-dash-success-fg",
  delivered: "bg-dash-neutral-soft text-dash-muted", cancelled: "bg-dash-danger-soft text-dash-danger-fg",
}
const PAY_PILL: Record<string, [string, string]> = {
  unpaid: ["Unpaid", "bg-dash-danger-soft text-dash-danger-fg"], partial: ["Partial", "bg-dash-warn-soft text-dash-warn-fg"], paid: ["Paid", "bg-dash-success-soft text-dash-success-fg"],
}
const SWATCH: Record<string, string> = {
  white: "#F4F1EA", "off-white": "#EDE6D6", beige: "#D9C7A4", cream: "#F2E8CF", black: "#1F2430", grey: "#9AA3B2", gray: "#9AA3B2", blue: "#3B5BA9", navy: "#1F2F5C",
  red: "#B42318", maroon: "#7B1E2B", green: "#2E7D5B", yellow: "#E8C547", pink: "#E8A0B4", brown: "#7A5230", purple: "#6D3FA0", orange: "#E8833A",
}

const whenTxt = (d: number | null) => (d === null ? "No due date" : d < 0 ? `Overdue ${-d}d` : d === 0 ? "Due today" : d === 1 ? "Tomorrow" : `In ${d} days`)
const whenCls = (d: number | null) => (d === null ? "text-dash-muted" : d < 0 ? "text-dash-danger-fg" : d <= 1 ? "text-dash-warn-fg" : "text-dash-muted")
const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

const card = "rounded-[14px] border border-dash-border bg-dash-card"
const h2 = "font-dash-display text-lg font-bold"
const linkCls = "text-[13px] font-semibold text-dash-accent hover:underline"
const ghostBtn = "inline-flex h-11 items-center rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Tailor shop</h1>
          <p className="mt-1 text-sm text-dash-muted">Today’s work, who is doing it, and what is due.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/tailor/measurements" className={ghostBtn}>Measurements</Link>
          <Link href="/dashboard/tailor/fabrics" className={ghostBtn}>Fabrics</Link>
          <Link href="/dashboard/tailor/orders/new" className="inline-flex h-11 items-center rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">+ New tailor order</Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center justify-between gap-3 rounded-[10px] bg-dash-danger-soft px-3.5 py-3 text-sm font-semibold text-dash-danger-fg">
          {error}<button type="button" onClick={load} className="underline">Retry</button>
        </p>
      )}

      {loading && !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
          <Skeleton className="h-[260px] rounded-[14px]" />
          <div className="grid gap-4 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-[14px]" />)}</div>
        </>
      ) : data ? (
        <>
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.kpis.map((k) => (
              <article key={k.label} className={cn(card, "flex flex-col gap-2 p-[18px]")}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-dash-muted">{k.label}</span>
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", TONE[k.tone])} aria-hidden><KpiIcon label={k.label} /></span>
                </div>
                <span className="font-dash-display text-[26px] font-bold tracking-tight tabular-nums">{fmtKpi(k)}</span>
                <span className={cn("text-xs", SUB_TONE[k.subTone ?? "muted"])}>{k.sub}</span>
              </article>
            ))}
          </section>

          <section className={cn(card, "p-5")}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <h2 className={h2}>Production board</h2>
              <span className="text-[13px] text-dash-muted">Open an order to move it along</span>
            </div>
            <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              {data.board.map((col) => (
                <div key={col.key} className="flex min-h-[160px] flex-col gap-2 rounded-xl bg-dash-bg p-2.5">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold"><span className="size-2 rounded-full" style={{ background: STAGE_DOT[col.key] }} />{col.label}</span>
                    <span className="text-xs font-bold text-dash-muted">{col.count}</span>
                  </div>
                  {col.orders.map((o) => <BoardCard key={o.id} o={o} />)}
                </div>
              ))}
            </div>
            {!data.has_orders && (
              <p className="mt-3.5 text-sm text-dash-muted">No tailor orders yet. <Link href="/dashboard/tailor/orders/new" className="font-semibold text-dash-accent">Create the first order</Link> and it will appear on this board.</p>
            )}
          </section>

          <div className="flex flex-wrap gap-4">
            <section className={cn(card, "flex flex-1 basis-[420px] flex-col gap-2.5 p-5")}>
              <div className="flex items-center justify-between"><h2 className={h2}>Collect payment</h2><Link href="/dashboard/tailor/payments" className={linkCls}>All payments →</Link></div>
              {data.dues.map((d) => (
                <div key={d.id} className="flex items-center gap-3 border-b border-dash-border-soft py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{d.customer} · {d.order_no}</div>
                    <div className="text-xs text-dash-muted">{d.stage_label}{d.phone ? ` · ${d.phone}` : ""}</div>
                  </div>
                  <span className="font-bold tabular-nums text-dash-danger-fg">{formatCurrency(d.due)}</span>
                  <Link href="/dashboard/tailor/payments" className="inline-flex h-9 items-center rounded-lg border border-dash-border px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft">Collect</Link>
                </div>
              ))}
              {data.dues.length === 0 && <p className="text-sm text-dash-muted">Nothing to collect. Every order is paid up.</p>}
            </section>

            <section className={cn(card, "flex flex-1 basis-[420px] flex-col gap-3 p-5")}>
              <div className="flex items-center justify-between"><h2 className={h2}>Dorji workload</h2><Link href="/dashboard/tailor/dorjis" className={linkCls}>Manage →</Link></div>
              {data.workload.map((d) => {
                const c = d.percent >= 100 && d.open > 0 ? "#B42318" : d.percent >= 75 ? "#F59E0B" : "#0F766E"
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-sm"><span className="font-semibold">{d.name}</span><span className="font-bold" style={{ color: c }}>{d.open} {d.open === 1 ? "piece" : "pieces"} open</span></div>
                    <div className="mt-1.5 h-2 rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full" style={{ width: `${d.percent}%`, background: c }} /></div>
                  </div>
                )
              })}
              {data.workload.length === 0 && <p className="text-sm text-dash-muted">No dorjis yet. <Link href="/dashboard/tailor/dorjis" className="font-semibold text-dash-accent">Add a dorji</Link> to track workload.</p>}
              {data.advice && <div className="rounded-[10px] bg-dash-warn-soft px-3 py-2.5 text-[13px] text-dash-warn-fg"><strong>{data.advice.head}</strong> {data.advice.body}</div>}
            </section>

            <section className={cn(card, "flex flex-1 basis-[300px] flex-col gap-2.5 p-5")}>
              <h2 className={h2}>Fabric alerts</h2>
              {data.fabric_alerts.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5">
                  <span className="size-7 shrink-0 rounded-lg border border-dash-border" style={{ background: f.hex_color || SWATCH[(f.color ?? "").toLowerCase()] || "#E3E6EE" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{f.name}{f.color ? ` · ${f.color}` : ""}</div>
                    <div className={cn("text-xs font-semibold", f.out ? "text-dash-danger-fg" : "text-dash-warn-fg")}>
                      {f.out ? "Out of stock" : `${f.stock} ${f.unit ?? ""} left (reorder at ${f.reorder_level})`}
                    </div>
                  </div>
                </div>
              ))}
              {data.fabric_alerts.length === 0 && <p className="text-sm text-dash-muted">{data.fabrics_count ? "No fabric is running low." : "No fabrics added yet."}</p>}
              <Link href="/dashboard/vendors/purchase-orders" className={cn(ghostBtn, "mt-auto")}>Order fabric</Link>
            </section>
          </div>

          <section className={cn(card, "flex flex-col gap-2.5 p-5")}>
            <div className="flex items-center justify-between"><h2 className={h2}>Recent orders</h2><Link href="/dashboard/tailor/orders" className={linkCls}>View all →</Link></div>
            {data.recent_orders.map((r) => {
              const pay = r.payment ? PAY_PILL[r.payment] : null
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-dash-border-soft py-2.5">
                  <div className="min-w-[200px] flex-1">
                    <Link href={`/dashboard/tailor/orders/${r.id}`} className="font-bold hover:underline">{r.order_no}</Link> <span className="font-semibold">{r.customer}</span>
                  </div>
                  <span className="font-bold tabular-nums">{formatCurrency(r.total)}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STAGE_PILL[r.stage])}>{r.stage_label}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", pay ? pay[1] : "bg-dash-neutral-soft text-dash-muted")}>{pay ? pay[0] : "—"}</span>
                </div>
              )
            })}
            {data.recent_orders.length === 0 && <p className="text-sm text-dash-muted">No orders yet.</p>}
          </section>

          <section className={cn(card, "flex flex-col gap-2.5 p-5")}>
            <div className="flex items-center justify-between"><h2 className={h2}>Due soon</h2><Link href="/dashboard/tailor/orders" className={linkCls}>All orders →</Link></div>
            {data.due_soon.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-dash-border-soft py-2.5">
                <div className="min-w-[200px] flex-1">
                  <Link href={`/dashboard/tailor/orders/${r.id}`} className="font-bold hover:underline">{r.order_no}</Link> <span className="font-semibold">{r.customer}</span>
                  <div className="text-xs text-dash-muted">{r.items}</div>
                </div>
                <span className="text-[13px] text-dash-muted">{fmtDate(r.delivery_date)}</span>
                <span className={cn("font-bold", whenCls(r.days_left))}>{whenTxt(r.days_left)}</span>
              </div>
            ))}
            {data.due_soon.length === 0 && <p className="text-sm text-dash-muted">No orders due in the next 7 days.</p>}
          </section>
        </>
      ) : null}
    </div>
  )
}

function BoardCard({ o }: { o: TailorBoardOrder }) {
  return (
    <article className="flex flex-col gap-1.5 rounded-[10px] border border-dash-border bg-dash-card p-2.5">
      <div className="flex justify-between gap-1.5">
        <Link href={`/dashboard/tailor/orders/${o.id}`} className="text-xs font-bold hover:underline">{o.order_no}</Link>
        {o.urgent && <span className="rounded-md bg-dash-danger-soft px-1.5 py-px text-[10px] font-bold text-dash-danger-fg">URGENT</span>}
      </div>
      <span className="text-[13px] font-semibold">{o.customer}</span>
      <span className="text-xs text-dash-neutral-fg">{o.items}</span>
      <div className="flex items-center justify-between text-xs">
        <span className="text-dash-muted">{o.dorji || "Not assigned"}</span>
        <span className={cn("font-bold", whenCls(o.days_left))}>{whenTxt(o.days_left)}</span>
      </div>
      <Link href={`/dashboard/tailor/orders/${o.id}`} className="flex h-8 items-center justify-center rounded-lg border border-dash-border text-xs font-bold hover:bg-dash-neutral-soft">Open order →</Link>
    </article>
  )
}
