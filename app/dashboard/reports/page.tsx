"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Printer } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import reportsApi, { type Report, type ReportCell, type ReportKpi, type ReportTable, type ReportType, type Tone } from "@/lib/reportsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { FormField } from "@/components/common/FormField"
import { Toolbar } from "@/components/common/Toolbar"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const TABS: [ReportType, string][] = [
  ["sales", "Sales summary"], ["purchases", "Purchases"], ["stock", "Stock valuation"], ["dues", "Receivables & payables"], ["pnl", "Profit & loss"],
]
const RANGES = [
  ["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"], ["lastmonth", "Last month"], ["ytd", "This year"], ["custom", "Custom…"],
] as const
type RangeId = (typeof RANGES)[number][0]

const TONE: Record<Tone, string> = {
  blue: "bg-blue-500",
  teal: "bg-emerald-600",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  red: "bg-destructive",
}
const SUB_TONE: Record<string, string> = { muted: "", red: "text-destructive", amber: "text-amber-600", teal: "text-emerald-600" }
const MIX_COLORS = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8"]

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)) }

function windowFor(range: RangeId, from: string, to: string): [string, string] {
  const today = ymd(new Date())
  switch (range) {
    case "today": return [today, today]
    case "7": return [addDays(today, -6), today]
    case "30": return [addDays(today, -29), today]
    case "month": return [`${today.slice(0, 8)}01`, today]
    case "lastmonth": { const f = `${today.slice(0, 8)}01`; const e = addDays(f, -1); return [`${e.slice(0, 8)}01`, e] }
    case "ytd": return [`${today.slice(0, 4)}-01-01`, today]
    default: return [from, to]
  }
}

const short = (n: number) => {
  const a = Math.abs(n)
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(1)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(1)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : String(Math.round(a))
  return (n < 0 ? "-" : "") + s.replace(".0", "")
}

function PagedTable({ table, fmt }: { table: ReportTable; fmt: (c: ReportCell) => string }) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  useEffect(() => { setPage(1) }, [table.title, table.rows.length])
  const rows = table.rows.slice((page - 1) * perPage, page * perPage)
  const paged = table.rows.length > 10
  return (
    <SectionCard title={table.title} className="gap-3 print:break-inside-avoid" contentClassName="px-2">
      <div className="overflow-x-auto">
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow>
              {table.columns.map((c, i) => <TableHead key={c + i} scope="col" className={i === 0 ? "text-left" : "text-right"}>{c}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, ri) => (
              <TableRow key={ri}>
                {r.map((c, ci) => (
                  <TableCell key={ci} className={cn("tabular-nums", ci === 0 ? "text-left" : "text-right", c.bold ? "font-bold" : c.t === "text" && ci === 0 ? "font-semibold" : "")}>{fmt(c)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {table.totalRow && table.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                {table.totalRow.map((c, ci) => (
                  <TableCell key={ci} className={cn("font-bold tabular-nums", ci === 0 ? "text-left" : "text-right")}>{fmt(c)}</TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {table.rows.length === 0 && <p className="px-3 text-sm text-muted-foreground">{table.empty}</p>}
      {paged && (
        <div className="print:hidden">
          <Separator className="mb-3" />
          <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(table.rows.length / perPage))} itemsPerPage={perPage} totalItems={table.rows.length}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
        </div>
      )}
    </SectionCard>
  )
}

export default function ReportsPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Reports")

  const [type, setType] = useState<ReportType>("sales")
  const [range, setRange] = useState<RangeId>("30")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const showRange = type !== "stock" && type !== "dues"
  const [wFrom, wTo] = windowFor(range, from, to)
  const customIncomplete = range === "custom" && showRange && (!from || !to)

  const load = useCallback(async () => {
    if (customIncomplete) { setLoading(false); return }
    setLoading(true); setError("")
    try {
      setReport(await reportsApi.get(type, showRange ? { from: wFrom || undefined, to: wTo || undefined } : undefined))
    } catch (e: any) {
      setReport(null)
      setError(e?.response?.data?.message || "Could not load this report.")
    } finally {
      setLoading(false)
    }
  }, [type, showRange, wFrom, wTo, customIncomplete])
  useEffect(() => { load() }, [load])

  const fmt = useCallback((c: ReportCell): string => {
    if (c.t === "money") return formatCurrency(Number(c.v) || 0)
    if (c.t === "int") return String(Math.round(Number(c.v) || 0))
    if (c.t === "pct") return typeof c.v === "number" ? `${Math.round(c.v)}%` : String(c.v)
    return String(c.v ?? "")
  }, [formatCurrency])
  const fmtKpi = (k: ReportKpi) => (k.kind === "money" ? formatCurrency(Number(k.value) || 0) : k.kind === "int" ? String(Math.round(Number(k.value) || 0)) : String(k.value))
  const fmtMix = (kind: "money" | "int", v: number) => (kind === "money" ? formatCurrency(v) : String(Math.round(v)))

  const periodTxt = useMemo(() => {
    if (!showRange) return `Snapshot as of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    if (!wFrom && !wTo) return "Pick a start and end date to see this report."
    const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `Period: ${wFrom ? f(wFrom) : "start"} to ${wTo ? f(wTo) : "today"}`
  }, [showRange, wFrom, wTo])

  const handleExport = () => {
    if (!report || !report.tables.some((t) => t.rows.length)) { toast({ variant: "destructive", title: "Nothing to export for this report" }); return }
    const out: string[][] = []
    report.kpis.forEach((k) => out.push([k.label, fmtKpi(k)]))
    report.tables.forEach((tb) => {
      out.push([]); out.push([tb.title]); out.push(tb.columns)
      tb.rows.forEach((r) => out.push(r.map((c) => (c.t === "text" ? String(c.v) : String(c.v)))))
      if (tb.totalRow) out.push(tb.totalRow.map((c) => String(c.v)))
    })
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const blob = new Blob([out.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `report-${type}-${ymd(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (blocked) return blocked

  const bars = report?.chart?.bars ?? []
  const maxBar = Math.max(1, ...bars.map((b) => Math.abs(b.value)))
  const hasBars = bars.some((b) => b.value !== 0)

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Reports"
        description={report?.subtitle ?? "Sales, purchases, stock, dues and profit in one place."}
        actions={<div className="flex gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export CSV</Button>
        </div>}
      />

      <Toolbar className="gap-3 print:hidden">
        <Tabs value={type} onValueChange={(v) => setType(v as ReportType)}>
          <TabsList aria-label="Report" className="h-auto flex-wrap">
            {TABS.map(([id, label]) => (
              <TabsTrigger key={id} value={id}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {showRange && (
          <div role="group" aria-label="Date range" className="flex flex-wrap gap-1.5">
            {RANGES.map(([id, label]) => (
              <Button key={id} type="button" variant={range === id ? "default" : "outline"} aria-pressed={range === id} onClick={() => setRange(id)}>{label}</Button>
            ))}
          </div>
        )}
      </Toolbar>

      {showRange && range === "custom" && (
        <div className="flex flex-wrap gap-3 print:hidden">
          <FormField orientation="horizontal" className="w-auto" label="From" htmlFor="report-from">
            <Input id="report-from" type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
          <FormField orientation="horizontal" className="w-auto" label="To" htmlFor="report-to">
            <Input id="report-to" type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></FormField>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{periodTxt}</p>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading && !report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : report ? (
        <>
          <section aria-label="Summary" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", report.kpis.length === 5 && "xl:grid-cols-5", report.kpis.length >= 6 && "xl:grid-cols-6", loading && "opacity-60")}>
            {report.kpis.map((k) => (
              <StatTile
                key={k.label}
                label={k.label}
                value={fmtKpi(k)}
                icon={<span aria-hidden className={cn("block size-3 rounded-full", TONE[k.tone])} />}
                hint={<span className={SUB_TONE[k.subTone ?? "muted"]}>{k.subMoney ? `${k.subMoney.prefix}${formatCurrency(k.subMoney.amount)}${k.subMoney.suffix}` : k.sub}</span>}
              />
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] print:grid-cols-1">
            {report.chart && (
              <SectionCard title={report.chart.title} className="print:break-inside-avoid">
                {!hasBars ? <p className="py-10 text-center text-sm text-muted-foreground">Nothing to chart for this period.</p> : (
                  <>
                    <div className="flex h-[200px] items-end gap-1.5">
                      {bars.map((b) => (
                        <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${formatCurrency(b.value)}`}>
                          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{b.value !== 0 ? short(b.value) : ""}</span>
                          <div className="w-full rounded-t-md" style={{ height: `${Math.max(2, Math.round((Math.abs(b.value) / maxBar) * 160))}px`, background: b.value < 0 ? "var(--destructive)" : "var(--primary)" }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex gap-1.5">{bars.map((b) => <span key={b.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">{b.label}</span>)}</div>
                  </>
                )}
              </SectionCard>
            )}
            {report.mixes.map((mx) => {
              const top = mx.items.slice(0, 6)
              const peak = Math.max(1, ...top.map((i) => Math.abs(i.value)))
              return (
                <SectionCard key={mx.title} title={mx.title} className="print:break-inside-avoid">
                  {top.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nothing to show for this period.</p> : (
                    <div className="flex flex-col gap-3">
                      {top.map((m, i) => (
                        <div key={m.label} className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-sm"><span className="font-medium">{m.label}</span><span className="tabular-nums text-muted-foreground">{fmtMix(mx.kind, m.value)}</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.round((Math.abs(m.value) / peak) * 100)}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )
            })}
          </div>

          {report.tables.map((tb) => <PagedTable key={tb.title} table={tb} fmt={fmt} />)}
        </>
      ) : null}
    </div>
  )
}
