"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Printer } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorApi, type TailorKpi, type TailorReport, type TailorReportCell, type TailorReportType, type TailorTone } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { KpiIcon } from "@/components/tailor/kpi-icon"

const TABS: [TailorReportType, string][] = [["orders", "Orders & income"], ["fabrics", "Fabrics"], ["dorjis", "Dorjis"]]
const RANGES = [
  ["month", "This month"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["ytd", "This year"], ["all", "All time"], ["custom", "Custom…"],
] as const
type RangeId = (typeof RANGES)[number][0]

const TONE: Record<TailorTone, string> = {
  blue: "bg-dash-accent-soft text-dash-accent-fg",
  teal: "bg-dash-success-soft text-dash-success-fg",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  amber: "bg-dash-warn-soft text-dash-warn-fg",
  red: "bg-dash-danger-soft text-dash-danger-fg",
}
const SUB_TONE: Record<string, string> = { muted: "text-dash-muted", red: "text-dash-danger-fg", amber: "text-dash-warn-fg", teal: "text-dash-success-fg" }
const MIX_COLORS = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8"]
const PILL: Record<string, string> = {
  paid: "bg-dash-success-soft text-dash-success-fg", partial: "bg-dash-warn-soft text-dash-warn-fg", unpaid: "bg-dash-danger-soft text-dash-danger-fg",
  "stage:new": "bg-dash-neutral-soft text-dash-neutral-fg", "stage:cutting": "bg-dash-warn-soft text-dash-warn-fg", "stage:stitching": "bg-dash-accent-soft text-dash-accent-fg",
  "stage:trial": "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300", "stage:ready": "bg-dash-success-soft text-dash-success-fg",
  "stage:delivered": "bg-dash-neutral-soft text-dash-muted", "stage:cancelled": "bg-dash-danger-soft text-dash-danger-fg",
  "fabric:ok": "bg-dash-success-soft text-dash-success-fg", "fabric:low": "bg-dash-warn-soft text-dash-warn-fg",
  "fabric:out-of-stock": "bg-dash-danger-soft text-dash-danger-fg", "fabric:inactive": "bg-dash-neutral-soft text-dash-muted",
}

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)) }

function windowFor(range: RangeId, from: string, to: string): [string, string] {
  const today = ymd(new Date())
  switch (range) {
    case "month": return [`${today.slice(0, 8)}01`, today]
    case "7": return [addDays(today, -6), today]
    case "30": return [addDays(today, -29), today]
    case "90": return [addDays(today, -89), today]
    case "ytd": return [`${today.slice(0, 4)}-01-01`, today]
    case "all": return ["", ""]
    default: return [from, to]
  }
}

const short = (n: number) => {
  const a = Math.abs(n)
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(1)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(1)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : String(Math.round(a))
  return (n < 0 ? "-" : "") + s.replace(".0", "")
}

export default function TailorReportsPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("TailorReports")

  const [type, setType] = useState<TailorReportType>("orders")
  const [range, setRange] = useState<RangeId>("month")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [report, setReport] = useState<TailorReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [wFrom, wTo] = windowFor(range, from, to)
  const customIncomplete = range === "custom" && (!from || !to)

  const load = useCallback(async () => {
    if (customIncomplete) { setLoading(false); return }
    setLoading(true); setError("")
    try {
      setReport(await tailorApi.getReport(type, { from: wFrom || undefined, to: wTo || undefined }))
    } catch (e: any) {
      setReport(null)
      setError(e?.response?.data?.message || "Could not load this report.")
    } finally {
      setLoading(false)
    }
  }, [type, wFrom, wTo, customIncomplete])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [type, wFrom, wTo])

  const table = report?.tables[0]

  const fmt = useCallback((c: TailorReportCell): string => {
    if (c.t === "money") return formatCurrency(Number(c.v) || 0)
    if (c.t === "int") return String(Math.round(Number(c.v) || 0))
    if (c.t === "pct") return `${Math.round(Number(c.v) || 0)}%`
    return String(c.v ?? "")
  }, [formatCurrency])
  const fmtKpi = (k: TailorKpi) => (k.kind === "money" ? formatCurrency(Number(k.value) || 0) : k.kind === "int" ? String(Math.round(Number(k.value) || 0)) : String(k.value))
  const unitTxt = (u: string | null | undefined) => (u ? ` ${u}` : "")
  const fmtNum = (v: number, kind: "money" | "int" | "num", unit?: string | null) =>
    kind === "money" ? formatCurrency(v) : kind === "num" ? `${Number(v.toFixed(1))}${unitTxt(unit)}` : String(Math.round(v))

  const periodTxt = useMemo(() => {
    if (range === "all") return "Period: all time"
    if (!wFrom && !wTo) return "Pick a start and end date to see this report."
    const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `Period: ${wFrom ? f(wFrom) : "start"} to ${wTo ? f(wTo) : "today"}`
  }, [range, wFrom, wTo])

  const handleExport = () => {
    if (!report || !table || table.rows.length === 0) { toast({ variant: "destructive", title: "Nothing to export for this period" }); return }
    const out: string[][] = [table.columns, ...table.rows.map((r) => r.map((c) => (c.t === "money" || c.t === "int" || c.t === "pct" ? String(c.v) : String(c.v))))]
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const blob = new Blob([out.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `tailor-${type}-${ymd(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (blocked) return blocked

  const bars = report?.chart?.bars ?? []
  const maxBar = Math.max(1, ...bars.map((b) => Math.abs(b.value)))
  const chartKind = report?.chart?.kind ?? "money"
  const rows = table ? table.rows.slice((page - 1) * perPage, page * perPage) : []

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Tailor reports</h1>
          <p className="mt-1 text-sm text-dash-muted">{report?.subtitle ?? "How the workshop is doing — orders, fabric and dorjis."}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"><Printer className="size-4" aria-hidden /> Print</button>
          <button type="button" onClick={handleExport} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"><Download className="size-4" aria-hidden /> Export CSV</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div role="tablist" aria-label="Report" className="flex flex-wrap gap-1 rounded-xl bg-dash-neutral-soft p-1">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={type === id} onClick={() => setType(id)}
              className={cn("h-10 rounded-[9px] px-4 text-sm font-semibold", type === id ? "bg-dash-card shadow-sm" : "text-dash-muted hover:text-dash-ink")}>{label}</button>
          ))}
        </div>
        <div role="group" aria-label="Date range" className="flex flex-wrap gap-1.5 md:ml-auto">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}
              className={cn("h-10 rounded-full border px-3.5 text-[13px] font-semibold", range === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{label}</button>
          ))}
        </div>
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 print:hidden">
          <label className="flex items-center gap-2 text-[13px] font-semibold">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent" /></label>
          <label className="flex items-center gap-2 text-[13px] font-semibold">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent" /></label>
        </div>
      )}
      <p className="text-[13px] text-dash-muted">{periodTxt}</p>

      {error && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3.5 py-3 text-sm font-semibold text-dash-danger-fg">{error}</p>}

      {loading && !report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : report ? (
        <>
          <section aria-label="Summary" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", report.kpis.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4", loading && "opacity-60")}>
            {report.kpis.map((k) => (
              <article key={k.label} className="rounded-[14px] border border-dash-border bg-dash-card p-[18px]">
                <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-dash-muted">{k.label}</span><span className={cn("flex size-8 items-center justify-center rounded-lg", TONE[k.tone])} aria-hidden><KpiIcon label={k.label} /></span></div>
                <div className="mt-2 font-dash-display text-[26px] font-bold tracking-tight tabular-nums">{fmtKpi(k)}</div>
                <div className={cn("mt-1 text-xs", SUB_TONE[k.subTone ?? "muted"])}>{k.sub}</div>
              </article>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr] print:grid-cols-1">
            <section className="min-w-0 rounded-[14px] border border-dash-border bg-dash-card p-5 print:break-inside-avoid">
              <h2 className="font-dash-display text-lg font-bold">{report.chart?.title}</h2>
              {bars.length === 0 ? <p className="mt-4 text-sm text-dash-muted">{table?.empty}</p> : (
                <div className="overflow-x-auto">
                  <div className="mt-4 flex h-[200px] items-end gap-2 border-b border-dash-border" style={{ minWidth: bars.length * 34 }}>
                    {bars.map((b) => (
                      <div key={b.label} className="flex h-full min-w-[26px] flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${fmtNum(b.value, chartKind, report.chart?.unit)}`}>
                        <span className="text-[11px] font-bold text-dash-neutral-fg">{b.value ? (chartKind === "money" ? short(b.value) : String(Number(b.value.toFixed(1)))) : ""}</span>
                        <div className="w-full max-w-[34px] rounded-t-md bg-dash-accent" style={{ height: `${Math.round((Math.abs(b.value) / maxBar) * 160)}px` }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2" style={{ minWidth: bars.length * 34 }}>{bars.map((b) => <span key={b.label} className="min-w-[26px] flex-1 pt-1.5 text-center text-[11px] text-dash-muted">{b.label}</span>)}</div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-[14px] border border-dash-border bg-dash-card p-5 print:break-inside-avoid">
              {report.mixes.map((mx, mi) => {
                const top = mx.items.slice(0, 6)
                const peak = Math.max(1, ...top.map((i) => Math.abs(i.value)))
                return (
                  <div key={mx.title} className={cn("flex flex-col gap-3", mi > 0 && "mt-3")}>
                    <h2 className="font-dash-display text-lg font-bold">{mx.title}</h2>
                    {top.length === 0 ? <p className="text-sm text-dash-muted">Nothing to show for this period.</p> : top.map((m, i) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-sm"><span className="font-semibold">{m.label}</span><span className="tabular-nums text-dash-neutral-fg">{fmtNum(m.value, mx.kind, mx.unit)}</span></div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full" style={{ width: `${Math.round((Math.abs(m.value) / peak) * 100)}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} /></div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          </div>

          {table && (
            <section className="rounded-[14px] border border-dash-border bg-dash-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                      {table.columns.map((c, i) => <th key={c + i} scope="col" className="px-4 py-3 font-semibold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} className={cn("border-b border-dash-border-soft px-4 py-3 tabular-nums", c.bold && "font-bold")}>
                            {c.tone && PILL[c.tone] ? <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", PILL[c.tone])}>{fmt(c)}</span> : fmt(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {table.rows.length === 0 && <p className="p-4 text-sm text-dash-muted">{table.empty}</p>}
              {table.rows.length > 10 && (
                <div className="border-t border-dash-border-soft p-4 print:hidden">
                  <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(table.rows.length / perPage))} itemsPerPage={perPage} totalItems={table.rows.length}
                    onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
                </div>
              )}
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}
