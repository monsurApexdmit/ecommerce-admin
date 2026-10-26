"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import { Download, Printer } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorApi, type TailorKpi, type TailorReport, type TailorReportCell, type TailorReportType } from "@/lib/tailorApi"
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

const SUB_TONE: Record<string, string> = { muted: "text-muted-foreground", red: "text-destructive", amber: "text-dash-warn-fg", teal: "text-dash-success-fg" }
const MIX_COLORS = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8"]
/** Report cell tone -> status text for StatusBadge's variant mapping. */
const PILL: Record<string, string> = {
  paid: "paid", partial: "partial", unpaid: "unpaid",
  "stage:new": "new", "stage:cutting": "cutting", "stage:stitching": "stitching", "stage:trial": "trial",
  "stage:ready": "ready", "stage:delivered": "delivered", "stage:cancelled": "cancelled",
  "fabric:ok": "in stock", "fabric:low": "low stock", "fabric:out-of-stock": "out of stock", "fabric:inactive": "inactive",
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Tailor reports"
        description={report?.subtitle ?? "How the workshop is doing — orders, fabric and dorjis."}
        actions={<div className="flex gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export CSV</Button>
        </div>}
      />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <SegmentedControl aria-label="Report" size="default" value={type} onValueChange={(v) => setType(v as TailorReportType)}
          options={TABS.map(([id, label]) => ({ value: id, label }))} />
        <SegmentedControl aria-label="Date range" className="md:ml-auto" value={range} onValueChange={(v) => setRange(v as RangeId)}
          options={RANGES.map(([id, label]) => ({ value: id, label }))} />
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 print:hidden">
          <FormField orientation="horizontal" className="w-auto gap-2" label="From" htmlFor="rep-from">
            <Input id="rep-from" type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
          <FormField orientation="horizontal" className="w-auto gap-2" label="To" htmlFor="rep-to">
            <Input id="rep-to" type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></FormField>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{periodTxt}</p>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading && !report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : report ? (
        <>
          <section aria-label="Summary" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", report.kpis.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4", loading && "opacity-60")}>
            {report.kpis.map((k) => (
              <StatTile key={k.label} label={k.label} value={fmtKpi(k)} icon={<KpiIcon label={k.label} />}
                hint={k.sub ? <span className={SUB_TONE[k.subTone ?? "muted"]}>{k.sub}</span> : undefined} />
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr] print:grid-cols-1">
            <SectionCard className="min-w-0 print:break-inside-avoid" title={report.chart?.title}>
              {bars.length === 0 ? <p className="text-sm text-muted-foreground">{table?.empty}</p> : (
                <div className="overflow-x-auto">
                  <div className="flex h-[200px] items-end gap-2 border-b" style={{ minWidth: bars.length * 34 }}>
                    {bars.map((b) => (
                      <div key={b.label} className="flex h-full min-w-[26px] flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${fmtNum(b.value, chartKind, report.chart?.unit)}`}>
                        <span className="text-[11px] font-semibold text-muted-foreground">{b.value ? (chartKind === "money" ? short(b.value) : String(Number(b.value.toFixed(1)))) : ""}</span>
                        <div className="w-full max-w-[34px] rounded-t-md bg-primary" style={{ height: `${Math.round((Math.abs(b.value) / maxBar) * 160)}px` }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2" style={{ minWidth: bars.length * 34 }}>{bars.map((b) => <span key={b.label} className="min-w-[26px] flex-1 pt-1.5 text-center text-[11px] text-muted-foreground">{b.label}</span>)}</div>
                </div>
              )}
            </SectionCard>

            <Card className="gap-3 p-5 print:break-inside-avoid">
              {report.mixes.map((mx, mi) => {
                const top = mx.items.slice(0, 6)
                const peak = Math.max(1, ...top.map((i) => Math.abs(i.value)))
                return (
                  <div key={mx.title} className={cn("flex flex-col gap-3", mi > 0 && "mt-3")}>
                    <h2 className="leading-none font-semibold">{mx.title}</h2>
                    {top.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to show for this period.</p> : top.map((m, i) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-sm"><span className="font-medium">{m.label}</span><span className="tabular-nums text-muted-foreground">{fmtNum(m.value, mx.kind, mx.unit)}</span></div>
                        <Progress value={Math.round((Math.abs(m.value) / peak) * 100)} aria-label={m.label}
                          className="mt-1.5 [&>[data-slot=progress-indicator]]:bg-(--mix)" style={{ "--mix": MIX_COLORS[i % MIX_COLORS.length] } as CSSProperties} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </Card>
          </div>

          {table && (
            <Card className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      {table.columns.map((c, i) => <TableHead key={c + i} scope="col">{c}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, ri) => (
                      <TableRow key={ri}>
                        {r.map((c, ci) => (
                          <TableCell key={ci} className={cn("tabular-nums", c.bold && "font-bold")}>
                            {c.tone && PILL[c.tone] ? <StatusBadge status={PILL[c.tone]} label={fmt(c)} /> : fmt(c)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {table.rows.length === 0 && <EmptyState className="p-4 md:p-6" title={table.empty || "No rows for this period"} />}
              {table.rows.length > 10 && (
                <div className="print:hidden">
                  <Separator />
                  <div className="p-4">
                  <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(table.rows.length / perPage))} itemsPerPage={perPage} totalItems={table.rows.length}
                    onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
